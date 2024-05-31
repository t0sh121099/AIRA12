var modal = document.getElementById('topicModal');
var modalTitle = document.getElementById('modalTitle');
var initialOptions = document.getElementById('initialOptions');
var reviewOptions = document.getElementById('reviewOptions');
var examOptions = document.getElementById('examOptions'); // Div for exam options
var webReviewLink = document.getElementById('webReviewLink');
var emailReviewLink = document.getElementById('emailReviewLink');
var span = document.getElementsByClassName("close")[0];
var examOnWeb = document.getElementById('examOnWeb');
var examViaEmail = document.getElementById('examViaEmail');

var currentTopicId = '';

function showOptions(topicId, topicName) {
    modalTitle.textContent = 'Choose an option for ' + topicName;
    currentTopicId = topicId;
    hideAllOptions();
    initialOptions.style.display = "block";
    modal.style.display = "block";
}

function showReviewOptions(event) {
    event.preventDefault();
    hideAllOptions();
    reviewOptions.style.display = "block";
    webReviewLink.href = "/review-topic/" + currentTopicId;
    emailReviewLink.href = "/send-review/" + currentTopicId;
}

function showExamOptions(event) {
    event.preventDefault();
    hideAllOptions();
    examOptions.style.display = 'block';
}

function openExamOnWeb(event) {
    event.preventDefault();
    console.log("openExamOnWeb called");
    hideAllOptions();
    examOnWeb.style.display = 'block';
}

function openExamviaEmail(event) {
    event.preventDefault();
    console.log("openExamviaEmail called");
    hideAllOptions();
    examViaEmail.style.display = 'block';
}

function takeComputational(event) {
    event.preventDefault();
    console.log("Taking exam on web for topic ID:", currentTopicId); // Debug
    window.location.href = '/take-computational-exam/' + currentTopicId;
}

function takeMultiplechoice(event) {
    event.preventDefault();
    console.log("Taking exam on web for topic ID:", currentTopicId); // Debug
    window.location.href = '/take-exam/' + currentTopicId;
}

function sendMultiplechoice() {
    console.log("Attempting to send exam by email for topic ID:", currentTopicId); // Debug
    fetch(`/send-exam-email/${currentTopicId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Exam sent successfully to your registered email.');
                window.location.href = '/homepage'; // Redirect to homepage
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to send exam to email. Please check console for more details.');
        });
}

function sendComputationalExamEmail() {
    console.log("Attempting to send computational exam by email for topic ID:", currentTopicId); // Debug
    fetch(`/send-computational-exam-email/${currentTopicId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Computational exam sent successfully to your registered email.');
                window.location.href = '/homepage'; // Redirect to homepage after success
            } else {
                alert(data.message); // Show error message if not successful
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to send computational exam to email. Please check console for more details.');
        });
}

span.onclick = function() {
    modal.style.display = "none";
    hideAllOptions(); // Ensure all options are hidden when modal is closed
};

window.onclick = function(event) {
    if (event.target === modal) {
        modal.style.display = "none";
        hideAllOptions(); // Ensure all options are hidden when modal is closed
    }
};

// Helper function to hide all option divs
function hideAllOptions() {
    console.log("hideAllOptions called");
    initialOptions.style.display = "none";
    reviewOptions.style.display = "none";
    examOptions.style.display = "none";
    examOnWeb.style.display = "none";
    examViaEmail.style.display = "none";
}


function takeMultiplechoice(event) {
    event.preventDefault();
    console.log("Taking exam on web for topic ID:", currentTopicId); // Debug
    showSpinner();
    window.location.href = '/take-exam/' + currentTopicId;
}

function takeComputational(event) {
    event.preventDefault();
    console.log("Taking exam on web for topic ID:", currentTopicId); // Debug
    showSpinner();
    window.location.href = '/take-computational-exam/' + currentTopicId;
}

function sendMultiplechoice(event) {
    event.preventDefault();
    console.log("Attempting to send exam by email for topic ID:", currentTopicId); // Debug
    showSpinner();
    fetch(`/send-exam-email/${currentTopicId}`)
        .then(response => response.json())
        .then(data => {
            hideSpinner();
            if (data.success) {
                alert('Exam sent successfully to your registered email.');
                window.location.href = '/homepage'; // Redirect to homepage
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            hideSpinner();
            console.error('Error:', error);
            alert('Failed to send exam to email. Please check console for more details.');
        });
}

function sendComputationalExamEmail() {
    console.log("Attempting to send computational exam by email for topic ID:", currentTopicId); // Debug
    showSpinner();
    fetch(`/send-computational-exam-email/${currentTopicId}`)
        .then(response => response.json())
        .then(data => {
            hideSpinner();
            if (data.success) {
                alert('Computational exam sent successfully to your registered email.');
                window.location.href = '/homepage'; // Redirect to homepage after success
            } else {
                alert(data.message); // Show error message if not successful
            }
        })
        .catch(error => {
            hideSpinner();
            console.error('Error:', error);
            alert('Failed to send computational exam to email. Please check console for more details.');
        });
}

function showSpinner() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

function hideSpinner() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

