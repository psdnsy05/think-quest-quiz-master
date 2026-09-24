/**
 * THINK QUEST: PROJECTOR DISPLAY
 * Runs the main audience screen, timer sounds, and answer reveals.
 */

let pState = {
    currentRound: null,
    questionIndex: 0,
    timer: 0,
    timerInterval: null,
    timerRunning: false,
    answerRevealed: false,
    audioContext: null,
    activeData: typeof quizData !== 'undefined' ? quizData : (typeof sampleQuizData !== 'undefined' ? sampleQuizData : null)
};

const pEls = {
    screens: document.querySelectorAll('.screen'),
    timerDisplay: document.getElementById('proj-timer-display'),
    timerProgress: document.getElementById('proj-timer-progress'),
    timerWrapper: document.getElementById('proj-timer-wrapper'),
    revealContainer: document.getElementById('proj-reveal-container'),
    optionsContainer: document.getElementById('proj-options-container'),
    btnTimer: document.getElementById('btn-proj-timer'),
    btnReveal: document.getElementById('btn-proj-reveal')
};

// ==========================================
// AUDIO LOGIC
// ==========================================
function initAudio() {
    if (!pState.audioContext) {
        pState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (pState.audioContext.state === 'suspended') {
        pState.audioContext.resume();
    }
}

function playTone(freq, type, duration) {
    initAudio();
    const osc = pState.audioContext.createOscillator();
    const gainNode = pState.audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, pState.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, pState.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, pState.audioContext.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(pState.audioContext.destination);
    osc.start();
    osc.stop(pState.audioContext.currentTime + duration);
}

// ==========================================
// INITIALIZATION & BINDINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-action="proj-round"]').forEach(btn => {
        btn.addEventListener('click', (e) => loadRound(e.currentTarget.dataset.round));
    });

    document.getElementById('btn-proj-home').addEventListener('click', () => showScreen('proj-home'));
    document.getElementById('btn-proj-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('btn-proj-next').addEventListener('click', () => navigate(1));
    
    pEls.btnTimer.addEventListener('click', toggleTimer);
    pEls.btnReveal.addEventListener('click', revealAnswer);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'f') {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
            else document.exitFullscreen();
        }
        
        // Only allow these shortcuts if on the question screen
        if (document.getElementById('proj-question').classList.contains('active')) {
            if (key === ' ') { e.preventDefault(); toggleTimer(); }
            if (key === 'a') revealAnswer();
            if (key === 'arrowright') navigate(1);
            if (key === 'arrowleft') navigate(-1);
            if (key === 'escape') showScreen('proj-home');
        }
    });
});

function showScreen(id) {
    pEls.screens.forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
    if (pState.timerRunning) stopTimer();
}

// ==========================================
// DISPLAY LOGIC
// ==========================================
function loadRound(roundId) {
    pState.currentRound = roundId;
    pState.questionIndex = 0;
    renderQuestion();
    showScreen('proj-question');
}

function renderQuestion() {
    const q = pState.activeData[pState.currentRound][pState.questionIndex];
    pState.answerRevealed = false;
    stopTimer();
    
    // Reset UI
    pState.timer = q.timeLimit;
    updateTimerUI();
    pEls.btnTimer.textContent = "Start Timer (Space)";
    pEls.btnReveal.classList.remove('hidden');
    pEls.revealContainer.classList.add('hidden');
    pEls.timerWrapper.classList.remove('hidden');

    ['A','B','C','D'].forEach(l => {
        const el = document.getElementById(`proj-opt-${l}`);
        el.classList.remove('correct-reveal');
    });

    // Populate Text
    document.getElementById('proj-round-name').textContent = q.roundTitle;
    document.getElementById('proj-progress').textContent = `Question ${pState.questionIndex + 1} of ${pState.activeData[pState.currentRound].length}`;
    document.getElementById('proj-points').textContent = `${q.points} Points`;
    document.getElementById('proj-question-text').textContent = q.question;

    // Handle Type
    if (q.questionType === 'multiple-choice') {
        pEls.optionsContainer.classList.remove('hidden');
        ['A','B','C','D'].forEach(l => {
            const el = document.getElementById(`proj-opt-${l}`);
            if (q.options[l]) {
                el.classList.remove('hidden');
                el.querySelector('.opt-text').textContent = q.options[l];
            } else {
                el.classList.add('hidden');
            }
        });
    } else {
        pEls.optionsContainer.classList.add('hidden');
    }
}

// ==========================================
// TIMER & SOUND
// ==========================================
function toggleTimer() {
    initAudio();
    if (pState.timerRunning) stopTimer();
    else startTimer();
}

function startTimer() {
    if (pState.timer <= 0 || pState.answerRevealed) return;
    pState.timerRunning = true;
    pEls.btnTimer.textContent = "Pause (Space)";
    
    pState.timerInterval = setInterval(() => {
        pState.timer--;
        updateTimerUI();
        
        // NEW: Beep every second from 5 down to 1
        if (pState.timer <= 5 && pState.timer > 0) {
            playTone(440, 'square', 0.2); 
        }
        
        if (pState.timer <= 0) {
            playTone(880, 'square', 0.8); // Final buzzer at zero
            stopTimer();
            pEls.btnTimer.textContent = "TIME IS UP";
        }
    }, 1000);
}

function stopTimer() {
    pState.timerRunning = false;
    clearInterval(pState.timerInterval);
    if(pState.timer > 0) pEls.btnTimer.textContent = "Resume (Space)";
}

function updateTimerUI() {
    const q = pState.activeData[pState.currentRound][pState.questionIndex];
    pEls.timerDisplay.textContent = pState.timer.toString().padStart(2, '0');
    pEls.timerProgress.style.width = ((pState.timer / q.timeLimit) * 100) + "%";
    
    if (pState.timer <= 3 && pState.timer > 0) {
        pEls.timerDisplay.classList.add('critical');
        pEls.timerProgress.style.backgroundColor = "var(--critical-red)";
    } else {
        pEls.timerDisplay.classList.remove('critical');
        pEls.timerProgress.style.backgroundColor = "var(--accent-gold)";
    }
}

// ==========================================
// REVEAL & NAVIGATE
// ==========================================
function revealAnswer() {
    if (pState.answerRevealed) return; 
    stopTimer();
    pState.answerRevealed = true;
    initAudio();
    playTone(600, 'sine', 0.4); 
    
    const q = pState.activeData[pState.currentRound][pState.questionIndex];
    
    pEls.timerWrapper.classList.add('hidden'); 
    pEls.revealContainer.classList.remove('hidden');
    pEls.btnReveal.classList.add('hidden');

    if (q.questionType === 'multiple-choice') {
        document.getElementById(`proj-opt-${q.correctOption}`).classList.add('correct-reveal');
        document.getElementById('proj-correct-ans').textContent = `${q.correctOption}. ${q.options[q.correctOption]}`;
    } else {
        document.getElementById('proj-correct-ans').textContent = q.correctAnswer;
    }
    
    document.getElementById('proj-explanation').textContent = q.explanation;
}

function navigate(direction) {
    const max = pState.activeData[pState.currentRound].length - 1;
    if (direction === 1 && pState.questionIndex < max) {
        pState.questionIndex++;
        renderQuestion();
    } else if (direction === -1 && pState.questionIndex > 0) {
        pState.questionIndex--;
        renderQuestion();
    }
}