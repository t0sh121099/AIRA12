require('dotenv').config();
const express = require("express");
const mysql = require("mysql");
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fetch = require('cross-fetch');



//openai code added here//
async function generateMultipleChoiceQuestions(topicDescription) {
    const apiKey = process.env.OPENAI_API_KEY;
    let questions = [];
    let attempts = 0;

    while (questions.length < 10 && attempts < 30) {
        const prompt = `Generate a detailed multiple-choice question about the following topic: ${topicDescription}. Include exactly four options and clearly mark one option as correct by appending '(correct)'.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "You are a helpful assistant tasked with creating educational multiple-choice questions. Ensure one answer is explicitly marked as (correct)." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 300
                })
            });
            const data = await response.json();
            const content = data.choices[0].message.content;

            const lines = content.split('\n');
            const questionText = lines[0];
            const optionsContent = lines.slice(1);
            let options = {};
            let correctAnswer = '';

            optionsContent.forEach(option => {
                const match = option.match(/^([A-D])\)\s*(.*?)(\s*\(correct\))?$/);
                if (match) {
                    options[match[1]] = match[2].trim();
                    if (match[3]) { // Checks if the '(correct)' tag is present
                        correctAnswer = match[1];
                    }
                }
            });

            // Validate if a correct answer exists
            if (correctAnswer) {
                questions.push({
                    text: questionText,
                    options: options,
                    correctAnswer: correctAnswer
                });
            }

        } catch (error) {
            console.error(`Failed to generate question:`, error);
        }
    }

    return questions;
}

async function generateComputationalQuestions(topicDescription, db, topicId, userId) {
    const apiKey = process.env.OPENAI_API_KEY;
    let questions = [];
    let attempts = 0;

    while (questions.length < 10 && attempts < 30) {  // Increased number of attempts
        const prompt = `Generate a computational math question based on the topic: ${topicDescription} and provide the final answer directly after the question.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "You are an assistant tasked with creating computational math questions. Provide each question directly followed by its correct answer, formatted as: Question: [question] | Answer: [answer]." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 150
                })
            });

            if (!response.ok) throw new Error(`HTTP error status: ${response.status}`);

            const data = await response.json();
            const content = data.choices && data.choices[0].message.content;

            if (content && content.includes('| Answer:')) {
                let [question, answer] = content.split('| Answer:');
                question = question.trim();
                answer = answer.trim().replace(/[\D]+$/, '');

                if (!question || !answer) {
                    attempts++;
                    continue;
                }

                // Database insert operation
                const insertQuery = 'INSERT INTO generatedcomputationalquestions (TopicID, UserID, QuestionDescription, CorrectAnswer) VALUES (?, ?, ?, ?)';
                await db.query(insertQuery, [topicId, userId, question, answer]);

                questions.push({ question, answer });
                console.log(`Generated and saved to DB: ${question} | Answer: ${answer}`);
            } else {
                console.error('Missing answer in response or improper format', data);
                attempts++;
            }
        } catch (error) {
            console.error(`Failed to generate computational question: ${error}`);
            attempts++;
        }
    }

    return questions;
}




// Assuming you have a similar pattern for your SQL query


const app = express();

// Middleware to parse JSON and form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'secret',
    saveUninitialized: true,
    resave: false,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(flash());

// Static files
app.use(express.static(__dirname + '/public'));
app.use(express.static('public'));

// MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "aira",
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log("MySQL connected...");
});

app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});


// Routes
app.get('/homepage', checkAuthenticated, (req, res) => {
    // Fetch the user's details from the database using the ID stored in the session
    const userId = req.session.userId; // Retrieve the user's ID from the session
    db.query('SELECT * FROM user WHERE UserID = ?', [userId], (err, results) => {
        if (err) {
            // Handle the error appropriately
            console.error('Database error:', err);
            req.flash('error', 'Internal Server Error');
            return res.redirect('/login'); // Redirect to login or error page
        }
        if (results.length > 0) {
            const user = results[0];
            // Render the homepage and pass the user's name and flash messages to the template
            res.render('homepage', {
                name: user.firstname, // Assuming 'firstname' is the column name
                successMessage: req.flash('success')[0], // Pass success message if any
                errorMessage: req.flash('error')[0] // Pass error message if any
            });
        } else {
            // Handle the case where the user is not found
            req.flash('error', 'User not found.');
            res.redirect('/login');
        }
    });
});


function checkAuthenticated(req, res, next) {
    if (req.session.userId) {
      return next();
    }
    req.flash('error', 'You must be logged in to view this page.');
    res.redirect('/login');
  }

  app.get('/login', (req, res) => {
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');
    res.render('login', {
        errorMessages: errorMessages,
        successMessages: successMessages
    });
});

app.get('/register', (req, res) => {
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');
    res.render('register', {
        errorMessages: errorMessages,
        successMessages: successMessages
    });
});

// Register POST handler
app.post('/register', [
    body('email', 'Invalid email').isEmail(),
    body('password', 'Password must be at least 5 characters long').isLength({ min: 5 }),
    body('confirmPassword', 'Passwords do not match').custom((value, { req }) => value === req.body.password)
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/register');
    }

    const { firstname, surname, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.query('INSERT INTO user (firstname, surname, email, password) VALUES (?, ?, ?, ?)',
    [firstname, surname, email, hashedPassword], (err, results) => {
        if (err) {
            console.error('Error inserting into the database', err);
            req.flash('error', 'Error registering user');
            res.redirect('/register');
        } else {
            req.flash('success', 'Registration successful!');
            res.redirect('/login'); // Redirect to the login page
        }
    });
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.query('SELECT * FROM user WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            req.flash('error', 'Internal Server Error');
            res.redirect('/login');
        } else if (results.length > 0) {
            const comparisonResult = await bcrypt.compare(password, results[0].password);
            if (comparisonResult) {
                req.session.userId = results[0].UserID;
                req.flash('success', 'Login successful!');
                res.redirect('/homepage');
            } else {
                req.flash('error', 'Incorrect password.');
                res.redirect('/login');
            }
        } else {
            req.flash('error', 'Email not found.');
            res.redirect('/login');
        }
    });
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return console.error('Logout Failed', err);
        }
        res.redirect('/login');
    });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve your CSS and JS files from public directory

// Endpoint to handle test generation

app.get('/review-topic', checkAuthenticated, (req, res) => {
    db.query('SELECT * FROM Topics', (err, topics) => {
        if (err) {
            console.error('Failed to fetch topics:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.render('review-topic', { topics: topics });
    });
});

app.get('/review-topic/:topicId', checkAuthenticated, (req, res) => {
    const { topicId } = req.params;
    db.query('SELECT * FROM Topics WHERE TopicID = ?', [topicId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (results.length > 0) {
            const topic = results[0];
            res.render('topic-detail', { topic: topic }); // Ensure you have a 'topic-detail.ejs' template
        } else {
            res.send('Topic not found.');
        }
    });
});

app.get('/select-topic', checkAuthenticated, (req, res) => {
    db.query('SELECT * FROM Topics', (err, topics) => {
        if (err) {
            console.error('Failed to fetch topics:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.render('select-topic', { topics: topics });
    });
});

app.get('/send-review/:topicId', checkAuthenticated, async (req, res) => {
    const { topicId } = req.params;
    const userId = req.session.userId; // Assuming userId is stored in the session

    db.query('SELECT u.email, t.TopicName, t.TopicDescription FROM User u JOIN Topics t ON t.TopicID = ? WHERE u.UserID = ?', [topicId, userId], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            const { email, TopicName, TopicDescription } = results[0];

            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(`<h1>${TopicName}</h1><p>${TopicDescription}</p>`);
            const pdf = await page.pdf({ format: 'A4' });
            await browser.close();

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            let mailOptions = {
                from: 'your-email@gmail.com',
                to: email,
                subject: `Reviewer for ${TopicName}`,
                text: 'Please find attached the review for your selected topic.',
                attachments: [
                    {
                        filename: `${TopicName}-Review.pdf`,
                        content: pdf,
                        contentType: 'application/pdf'
                    }
                ]
            };

            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                    console.log('Error sending mail:', error);
                    res.send('<script>alert("Failed to send review. Please try again."); window.location="/select-topic";</script>');
                } else {
                    console.log('Email sent: ' + info.response);
                    res.send(`<script>alert("Review sent successfully to ${email}."); window.location="/select-topic";</script>`);
                }
            });
        } else {
            res.send('Topic or user not found.');
        }
    });
});

// Route to send exam questions via email

app.get('/take-exam/:topicId', async (req, res) => {
    const topicId = req.params.topicId;
    const userId = req.session.userId;

    db.query('SELECT TopicDescription FROM topics WHERE TopicID = ?', [topicId], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).send('Topic not found');
        }

        try {
            const topicDescription = results[0].TopicDescription;
            const questions = await generateMultipleChoiceQuestions(topicDescription);
            console.log("Generated questions:", questions);

            req.session.questions = questions;  // Store the questions in the session for later use during submission

            const insertPromises = questions.map(question => {
                const { text, options, correctAnswer } = question; // Update: changed correctOption to correctAnswer
                const optionsJSON = JSON.stringify(options);
                return db.query(
                    'INSERT INTO GeneratedQuestions (TopicID, UserID, QuestionText, Options, CorrectAnswer) VALUES (?, ?, ?, ?, ?)',
                    [topicId, userId, text, optionsJSON, correctAnswer] // Update the field name here as well
                );
            });

            await Promise.all(insertPromises);
            res.render('take-exam', { questions, topicId });
        } catch (error) {
            console.error('Error during question generation:', error);
            res.status(500).send('Failed to generate questions');
        }
    });
});

app.get('/take-computational-exam/:topicId', async (req, res) => {
    const topicId = req.params.topicId;
    const userId = req.session.userId || 'defaultUserID'; // Fallback user ID if not defined in session

    db.query('SELECT TopicDescription FROM topics WHERE TopicID = ?', [topicId], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error occurred');
        }
        if (results.length === 0) {
            return res.status(404).send('Topic not found');
        }

        const topicDescription = results[0].TopicDescription;

        try {
            const examStartTime = new Date();
            req.session.examStartTime = examStartTime; // Store start time as Date object

            // Log to check type
            console.log(typeof req.session.examStartTime, req.session.examStartTime);

            const questions = await generateComputationalQuestions(topicDescription, db, topicId, userId);
            req.session.questions = questions; // Store questions in the session
            res.render('take-computational-exam', { questions, topicId, userId });
        } catch (error) {
            console.error('Error during computational question generation:', error);
            res.status(500).send('Failed to generate computational questions');
        }
    });
}); 

// Node.js/Express route to handle exam submission
app.get('/send-exam-email/:topicId', checkAuthenticated, async (req, res) => {
    const topicId = req.params.topicId;
    const userId = req.session.userId;

    try {
        // Retrieve the topic name and user email.
        const queryResult = await new Promise((resolve, reject) => {
            db.query('SELECT t.TopicName, u.email FROM topics t JOIN user u ON u.UserID = ? WHERE t.TopicID = ?', [userId, topicId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        if (!queryResult) {
            return res.status(404).send('Topic not found or user not found');
        }

        const { TopicName, email } = queryResult;
        const questions = await generateMultipleChoiceQuestions(TopicName); // Pass the correct topic name
        console.log("Generated questions:", questions);

        // Insert generated questions into the database
        const insertPromises = questions.map(question => {
            const { text, options, correctAnswer } = question;
            const optionsJSON = JSON.stringify(options);
            return db.query(
                'INSERT INTO GeneratedQuestions (TopicID, UserID, QuestionText, Options, CorrectAnswer, QuestionType) VALUES (?, ?, ?, ?, ?, ?)',
                [topicId, userId, text, optionsJSON, correctAnswer, 'Multiple Choice']
            );
        });

        await Promise.all(insertPromises);

        // Render the EJS template to HTML
        const htmlContent = await new Promise((resolve, reject) => {
            res.render('exam-template', { topicName: TopicName, questions: questions, questionType: 'Multiple Choice' }, (err, html) => {
                if (err) reject(err);
                else resolve(html);
            });
        });

        // Create a PDF with the generated questions
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4' });
        await browser.close();

        // Send the PDF via email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Exam Questions for Your Review',
            text: 'Attached are your exam questions.',
            attachments: [{
                filename: 'ExamQuestions.pdf',
                content: pdf,
                contentType: 'application/pdf'
            }]
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.error('Error sending exam email:', error);
                res.status(500).json({ success: false, message: 'Failed to send exam questions via email.' });
            } else {
                console.log('Email sent: ' + info.response);
                res.json({ success: true, message: 'Exam questions sent successfully to your registered email.' });
            }
        });

    } catch (error) {
        console.error('Error during exam generation and email sending:', error);
        res.status(500).send('Failed to process your request.');
    }
});



app.get('/send-computational-exam-email/:topicId', checkAuthenticated, async (req, res) => {
    const topicId = req.params.topicId;
    const userId = req.session.userId;

    try {
        // Retrieve the topic name and user email.
        const queryResult = await new Promise((resolve, reject) => {
            db.query('SELECT t.TopicName, u.email FROM topics t JOIN user u ON u.UserID = ? WHERE t.TopicID = ?', [userId, topicId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        if (!queryResult) {
            return res.status(404).send('Topic not found or user not found');
        }

        const { TopicName, email } = queryResult;
        const questions = await generateComputationalQuestions(TopicName, db, topicId, userId);
        console.log("Generated questions:", questions);

        // Insert generated questions into the database
        const insertPromises = questions.map(question => {
            const { question: text } = question;
            return db.query(
                'INSERT INTO GeneratedComputationalQuestions (TopicID, UserID, QuestionDescription, QuestionType) VALUES (?, ?, ?, ?)',
                [topicId, userId, text, 'Computational']
            );
        });

        await Promise.all(insertPromises);

        // Render the EJS template to HTML
        const htmlContent = await new Promise((resolve, reject) => {
            res.render('computational-exam-template', { topicName: TopicName, questions: questions, questionType: 'Computational' }, (err, html) => {
                if (err) reject(err);
                else resolve(html);
            });
        });

        // Create a PDF with the generated questions
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4' });
        await browser.close();

        // Send the PDF via email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Computational Exam Questions for Your Review',
            text: 'Attached are your computational exam questions.',
            attachments: [{
                filename: 'ComputationalExamQuestions.pdf',
                content: pdf,
                contentType: 'application/pdf'
            }]
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.error('Error sending computational exam email:', error);
                res.status(500).json({ success: false, message: 'Failed to send computational exam questions via email.' });
            } else {
                console.log('Email sent: ' + info.response);
                res.json({ success: true, message: 'Computational exam questions sent successfully to your registered email.' });
            }
        });

    } catch (error) {
        console.error('Error during computational exam generation and email sending:', error);
        res.status(500).send('Failed to process your request.');
    }
});


app.post('/submit-exam/:topicId', async (req, res) => {
    const topicId = req.params.topicId;
    const userId = req.session.userId;
    const answers = req.body;
    const questions = req.session.questions;

    if (!questions || questions.length === 0) {
        console.error("No questions available or session expired.");
        return res.status(400).send("No questions found or session expired.");
    }

    try {
        let score = 0;
        questions.forEach((question, index) => {
            const correctAnswer = question.correctAnswer ? question.correctAnswer.trim().toLowerCase() : '';
            const userAnswer = answers[`answer${index}`] ? answers[`answer${index}`].trim().toLowerCase() : '';

            console.log(`Question ${index + 1}: Correct Answer = '${correctAnswer}', User Answer = '${userAnswer}'`);

            if (userAnswer === correctAnswer) {
                score++;
                console.log(`Match found for Question ${index + 1}. Updated Score: ${score}`);
            } else {
                console.log(`No match for Question ${index + 1}. Score remains: ${score}`);
            }
        });

        console.log(`Final Score: ${score}`);

        await db.query('INSERT INTO Assessments (UserID, TopicID, Score, TotalQuestions) VALUES (?, ?, ?, ?)',
            [userId, topicId, score, questions.length]);

        req.session.questions = null; // Clear the questions from the session
        res.redirect('/homepage');
    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(500).send('Error submitting exam');
    }
});

app.post('/submit-computational-exam/:topicId', async (req, res) => {
    const { topicId } = req.params;
    const userId = req.session.userId; // Ensure this is set in your session

    if (!userId) {
        return res.status(401).send("User not authenticated.");
    }

    const answers = req.body.answers || [];
    const questions = req.session.questions;

    if (!questions || questions.length === 0) {
        console.error("No questions available or session expired.");
        return res.status(400).send("No questions found or session expired.");
    }

    let score = 0;
    questions.forEach((question, index) => {
        const correctAnswer = question.answer.trim().toLowerCase();
        const userAnswer = answers[index] ? answers[index].trim().toLowerCase() : '';
        console.log(`Question ${index + 1}: correctAnswer = '${correctAnswer}', userAnswer = '${userAnswer}'`);
        if (userAnswer === correctAnswer) {
            score++;
        }
    });
    console.log(`Final Score: ${score} out of ${questions.length}`);
    

    console.log(`Final Score: ${score} out of ${questions.length}`);

    // SQL Insert statement
    const insertSql = 'INSERT INTO exam_results (UserID, TopicID, Score, TotalQuestions, CreatedAt) VALUES (?, ?, ?, ?, NOW())';
    db.query(insertSql, [userId, topicId, score, questions.length], (error, results) => {
    if (error) {
        console.error('Failed to insert exam results:', error);
        return res.status(500).send('Error submitting exam');
    }
    console.log('Exam results saved:', results);
    req.session.questions = null; // Clear the session data
    res.redirect('/homepage');
});
});

//assesment 

app.get('/assessment', async (req, res) => {
    const userId = req.session.userId; // Retrieves the user ID from the session

    if (!userId) {
        return res.status(401).send('User not authenticated'); // Send an error if the user is not authenticated
    }

    const query = `
        SELECT t.TopicName, 'Multiple Choice' AS QuestionType, a.Score, a.TotalQuestions, a.CreatedAt
        FROM Assessments a
        JOIN Topics t ON a.TopicID = t.TopicID
        WHERE a.UserID = ?
        UNION ALL
        SELECT t.TopicName, 'Computational' AS QuestionType, e.Score, e.TotalQuestions, e.CreatedAt
        FROM exam_results e
        JOIN Topics t ON e.TopicID = t.TopicID
        WHERE e.UserID = ?
        ORDER BY CreatedAt DESC;
    `;

    db.query(query, [userId, userId], (err, results) => {
        if (err) {
            console.error('Error retrieving assessments:', err);
            return res.status(500).send('Failed to retrieve assessments');
        }

        if (results.length > 0) {
            res.render('assessment', { assessments: results }); // Render the assessment page with results
        } else {
            res.render('assessment', { assessments: [] }); // Render the assessment page with an empty array if no results
        }
    });
});
// Server listening
app.listen(5001, () => {
    console.log("Server started on port 5001");
});


