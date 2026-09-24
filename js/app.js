/**
 * THINK QUEST: CONTESTANT TERMINAL
 * Visual Auto-Grade System with Pacing, Protest Logistics, and .txt Export
 */

let state = {
    teamName: "",
    currentRound: null,
    questionIndex: 0,
    roundScore: 0,
    questionsCorrect: 0,
    timer: 0,
    timerInterval: null,
    isLocked: false,
    selectedAnswer: null,
    lastTeamAnsDisplay: "",
    activeData: typeof quizData !== 'undefined' ? quizData : (typeof sampleQuizData !== 'undefined' ? sampleQuizData : null),
    inRound: false,
    roundHistory: [],
    ignoreBlur: false
};

const els = {
    screens: document.querySelectorAll('.screen'),
    teamSelect: document.getElementById('team-select'),
    mcOptions: document.querySelectorAll('.mc-option'),
    idInput: document.getElementById('id-answer-input'),
    readySection: document.getElementById('ready-section'),
    activeQuestionSection: document.getElementById('active-question-section'),
    btnStartQuestion: document.getElementById('btn-start-question'),
    
    // Result Elements
    resultSection: document.getElementById('question-result-section'),
    resultMessage: document.getElementById('q-result-message'),
    resultCorrectAns: document.getElementById('q-result-correct-ans'),
    resultExplanation: document.getElementById('q-result-explanation'),
    
    // Buttons
    btnAccept: document.getElementById('btn-accept-result'),
    btnProtest: document.getElementById('btn-protest-result'),
    btnResolveProtest: document.getElementById('btn-resolve-protest'),
    btnCancelProtest: document.getElementById('btn-cancel-protest'),
    protestScreen: document.getElementById('protest-screen'),
    protestTeamAns: document.getElementById('protest-team-ans'),
    
    // Download button
    btnDownloadScores: document.getElementById('btn-download-scores')
};

// ==========================================
// CORE DISPLAY HELPER (Fixes Blank Screens)
// ==========================================
function showScreen(screenId) {
    els.screens.forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden'); // Force hiding background elements
    });
    const activeScreen = document.getElementById(screenId);
    activeScreen.classList.remove('hidden'); // Force revealing target
    activeScreen.classList.add('active');
}

// ==========================================
// SECURITY LOGIC
// ==========================================
function initSecurity() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || 
           (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') || 
           (e.ctrlKey && e.key.toLowerCase() === 'u')) {
            e.preventDefault();
        }
    });

    window.addEventListener('blur', () => {
        if (state.ignoreBlur) return;
        
        // Do not trigger security violation if the protest screen is currently open
        if (els.protestScreen && els.protestScreen.classList.contains('active')) return;
        
        if (state.inRound && !document.getElementById('security-screen').classList.contains('active')) {
            triggerSecurityViolation();
        }
    });

    document.getElementById('btn-proctor-clear').addEventListener('click', () => {
        state.ignoreBlur = true;
        const pass = prompt("Proctor Override Password:");
        
        if (pass === "thinkquest26") {
            document.getElementById('security-screen').classList.remove('active');
            document.getElementById('security-screen').classList.add('hidden');
            if (document.fullscreenElement === null) document.documentElement.requestFullscreen().catch(()=>{});
        }
        
        setTimeout(() => state.ignoreBlur = false, 1500); 
    });
}

function triggerSecurityViolation() {
    showScreen('security-screen');
    state.roundScore = 0;
    clearInterval(state.timerInterval);
}

// ==========================================
// LOGIN & LOBBY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initSecurity();
    
    if (!state.activeData) {
        document.body.innerHTML = "<h1 style='color:red;text-align:center;margin-top:20%'>FATAL ERROR: js/questions.js missing.</h1>";
        return;
    }

    document.getElementById('btn-login').addEventListener('click', () => {
        const team = els.teamSelect.value;
        if (!team) {
            alert("Please select your team first.");
            return;
        }
        state.teamName = team;
        document.getElementById('lobby-team-name').textContent = team;
        document.getElementById('q-team-name').textContent = team;
        
        document.documentElement.requestFullscreen().catch(err => console.log(err));
        showScreen('lobby-screen');
    });

    document.querySelectorAll('[data-action="start-round"]').forEach(btn => {
        btn.addEventListener('click', (e) => startRound(e.currentTarget.dataset.round));
    });

    els.btnStartQuestion.addEventListener('click', revealQuestion);

    // Flow controls
    els.btnAccept.addEventListener('click', proceedToNext);
    
    els.btnProtest.addEventListener('click', () => {
        const q = state.activeData[state.currentRound][state.questionIndex];
        
        // Safely insert answers into Protest Overlay
        if (els.protestTeamAns) {
            els.protestTeamAns.textContent = state.lastTeamAnsDisplay || "No Answer Submitted";
        }
        if (document.getElementById('protest-official-ans')) {
            if (q.questionType === 'multiple-choice') {
                document.getElementById('protest-official-ans').textContent = `${q.correctOption}. ${q.options[q.correctOption]}`;
            } else {
                document.getElementById('protest-official-ans').textContent = q.correctAnswer;
            }
        }
        
        els.protestScreen.classList.remove('hidden');
        els.protestScreen.classList.add('active');
    });

    els.btnCancelProtest.addEventListener('click', () => {
        els.protestScreen.classList.remove('active');
        els.protestScreen.classList.add('hidden');
    });

    // Proctor Protest Resolution
    els.btnResolveProtest.addEventListener('click', () => {
        state.ignoreBlur = true;
        const pass = prompt("Proctor Password:");
        
        if (pass === null) {
            setTimeout(() => state.ignoreBlur = false, 1500); // Wait 1.5 seconds before rearming security
            return;
        }

        if (pass === "thinkquest26") {
            const override = confirm("Did this team WIN the protest?\n\nClick OK to manually award points.\nClick Cancel to keep the score as INCORRECT.");
            
            if (override) {
                const q = state.activeData[state.currentRound][state.questionIndex];
                let lastLog = state.roundHistory[state.roundHistory.length - 1];
                
                if (!lastLog.isCorrect) {
                    lastLog.isCorrect = true;
                    lastLog.ptsEarned = q.points;
                    state.roundScore += q.points;
                    state.questionsCorrect++;

                    els.resultMessage.textContent = "CORRECT (PROTEST WON)! +" + q.points;
                    els.resultMessage.className = "text-correct";
                }
            }
            
            els.protestScreen.classList.remove('active');
            els.protestScreen.classList.add('hidden');
            
        } else {
            alert("Incorrect Proctor Password.");
        }
        
        setTimeout(() => state.ignoreBlur = false, 1500);
    });

    els.mcOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (state.isLocked) return;
            els.mcOptions.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            state.selectedAnswer = e.currentTarget.dataset.opt;
        });
    });

    els.idInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !state.isLocked) {
            e.preventDefault();
            els.idInput.blur();
        }
    });

    document.getElementById('btn-return-lobby').addEventListener('click', () => {
        showScreen('lobby-screen');
    });

    els.btnDownloadScores.addEventListener('click', downloadScoresheet);
});

// ==========================================
// ROUND LOGIC 
// ==========================================
function startRound(roundId) {
    if (!state.activeData[roundId] || state.activeData[roundId].length === 0) {
        alert("No questions found for this round.");
        return;
    }
    
    state.currentRound = roundId;
    state.questionIndex = 0;
    state.roundScore = 0;
    state.questionsCorrect = 0;
    state.inRound = true;
    state.roundHistory = []; 
    
    loadQuestion();
}

function loadQuestion() {
    const q = state.activeData[state.currentRound][state.questionIndex];
    state.isLocked = false;
    state.selectedAnswer = null;
    
    els.resultSection.classList.add('hidden');
    els.readySection.classList.remove('hidden');
    els.activeQuestionSection.classList.add('hidden');
    
    document.getElementById('ready-q-num').textContent = `Question ${state.questionIndex + 1}`;

    els.mcOptions.forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    els.idInput.value = "";
    els.idInput.disabled = false;

    document.getElementById('timer-status').textContent = "Waiting...";
    document.getElementById('display-timer').className = "timer-display";
    document.getElementById('display-timer').textContent = q.timeLimit.toString().padStart(2, '0');
    document.getElementById('timer-progress').style.width = "100%";
    document.getElementById('timer-progress').style.backgroundColor = "var(--accent-gold)";

    document.getElementById('display-round-name').textContent = q.roundTitle;
    document.getElementById('display-progress').textContent = `Question ${state.questionIndex + 1} of ${state.activeData[state.currentRound].length}`;
    document.getElementById('display-points').textContent = `${q.points} Points`;
    document.getElementById('display-question-text').textContent = q.question;

    if (q.questionType === 'multiple-choice') {
        document.getElementById('options-container').classList.remove('hidden');
        document.getElementById('identification-container').classList.add('hidden');
        
        ['A','B','C','D'].forEach(l => {
            const el = document.getElementById(`opt-text-${l}`);
            if (q.options[l]) {
                document.querySelector(`[data-opt="${l}"]`).classList.remove('hidden');
                el.textContent = q.options[l];
            } else {
                document.querySelector(`[data-opt="${l}"]`).classList.add('hidden');
            }
        });
    } else {
        document.getElementById('options-container').classList.add('hidden');
        document.getElementById('identification-container').classList.remove('hidden');
    }

    showScreen('question-screen');
}

function revealQuestion() {
    const q = state.activeData[state.currentRound][state.questionIndex];
    
    els.readySection.classList.add('hidden');
    els.activeQuestionSection.classList.remove('hidden');
    
    if (q.questionType === 'identification') {
        els.idInput.focus();
    }
    
    startTimer(q.timeLimit);
}

// ==========================================
// TIMER & GRADING
// ==========================================
function startTimer(seconds) {
    state.timer = seconds;
    document.getElementById('timer-status').textContent = "Answer Now";
    updateTimerUI(seconds);
    
    state.timerInterval = setInterval(() => {
        state.timer--;
        updateTimerUI(seconds);
        
        if (state.timer <= 0) {
            clearInterval(state.timerInterval);
            lockAndGrade();
        }
    }, 1000);
}

function updateTimerUI(maxTime) {
    const d = document.getElementById('display-timer');
    const p = document.getElementById('timer-progress');
    
    d.textContent = state.timer.toString().padStart(2, '0');
    p.style.width = ((state.timer / maxTime) * 100) + "%";
    
    if (state.timer <= 3 && state.timer > 0) {
        d.classList.add('critical');
        p.style.backgroundColor = "var(--critical-red)";
    } else {
        d.classList.remove('critical');
        p.style.backgroundColor = "var(--accent-gold)";
    }
}

function lockAndGrade() {
    state.isLocked = true;
    document.getElementById('timer-status').textContent = "TIME'S UP! GRADING...";
    document.getElementById('timer-progress').style.width = "0%";
    
    els.mcOptions.forEach(b => b.disabled = true);
    els.idInput.disabled = true;

    const q = state.activeData[state.currentRound][state.questionIndex];
    let isCorrect = false;
    let teamAnsDisplay = "No Answer";
    let correctAnsDisplay = "";

    if (q.questionType === 'multiple-choice') {
        if (state.selectedAnswer === q.correctOption) {
            isCorrect = true;
        }
        if (state.selectedAnswer) {
            teamAnsDisplay = `${state.selectedAnswer}. ${q.options[state.selectedAnswer]}`;
        }
        correctAnsDisplay = `${q.correctOption}. ${q.options[q.correctOption]}`;
    } else {
        const rawInput = els.idInput.value.trim();
        state.selectedAnswer = rawInput.toLowerCase();
        teamAnsDisplay = rawInput || "No Answer";
        correctAnsDisplay = q.correctAnswer;
        
        const mainAns = q.correctAnswer.trim().toLowerCase();
        const altAns = q.acceptedAlternativeAnswers.map(a => a.trim().toLowerCase());
        
        if (state.selectedAnswer === mainAns || altAns.includes(state.selectedAnswer)) {
            isCorrect = true;
        }
    }

    state.lastTeamAnsDisplay = teamAnsDisplay;

    state.roundHistory.push({
        qNum: state.questionIndex + 1,
        teamAns: teamAnsDisplay,
        correctAns: correctAnsDisplay,
        isCorrect: isCorrect,
        ptsEarned: isCorrect ? q.points : 0,
        maxPts: q.points
    });

    if (isCorrect) {
        state.roundScore += q.points;
        state.questionsCorrect++;
    }

    els.resultSection.classList.remove('hidden');
    
    if (isCorrect) {
        els.resultMessage.textContent = "CORRECT! +" + q.points;
        els.resultMessage.className = "text-correct";
        els.btnProtest.classList.add('hidden'); 
    } else {
        els.resultMessage.textContent = "INCORRECT";
        els.resultMessage.className = "text-incorrect";
        els.btnProtest.classList.remove('hidden'); 
    }
    
    els.resultCorrectAns.innerHTML = `The official correct answer is:<br><strong>${correctAnsDisplay}</strong>`;
    els.resultExplanation.innerHTML = `<strong>Explanation:</strong> ${q.explanation}`;
}

// ==========================================
// NAVIGATION & SCORE EXPORT
// ==========================================
function proceedToNext() {
    if (state.questionIndex < state.activeData[state.currentRound].length - 1) {
        state.questionIndex++;
        loadQuestion();
    } else {
        endRound();
    }
}

function endRound() {
    state.inRound = false; 
    
    document.getElementById('score-team-name').textContent = state.teamName;
    document.getElementById('score-points').textContent = state.roundScore;
    document.getElementById('score-breakdown').textContent = `${state.questionsCorrect} Correct / ${state.activeData[state.currentRound].length} Total`;
    
    const tbody = document.getElementById('review-table-body');
    tbody.innerHTML = "";
    
    state.roundHistory.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.qNum}</td>
            <td class="${log.isCorrect ? 'td-correct' : 'td-incorrect'}">${log.teamAns}</td>
            <td>${log.correctAns}</td>
            <td>${log.ptsEarned} / ${log.maxPts}</td>
        `;
        tbody.appendChild(tr);
    });

    showScreen('score-screen');
}

function downloadScoresheet() {
    let content = `=======================================\n`;
    content += `THINK QUEST - OFFICIAL SCORESHEET\n`;
    content += `=======================================\n`;
    content += `Team: ${state.teamName}\n`;
    content += `Round: ${state.activeData[state.currentRound][0].roundTitle}\n`;
    content += `Total Points: ${state.roundScore}\n`;
    content += `Correct Answers: ${state.questionsCorrect} / ${state.activeData[state.currentRound].length}\n\n`;
    content += `QUESTION BREAKDOWN:\n`;
    content += `---------------------------------------\n`;

    state.roundHistory.forEach(log => {
        content += `Q${log.qNum}:\n`;
        content += `Team Answer: ${log.teamAns}\n`;
        content += `Correct Answer: ${log.correctAns}\n`;
        content += `Result: ${log.isCorrect ? 'CORRECT' : 'INCORRECT'} (${log.ptsEarned} / ${log.maxPts} pts)\n`;
        content += `---------------------------------------\n`;
    });

    content += `\nEnd of Report.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const safeTeamName = state.teamName.replace(/[^a-z0-9]/gi, '_');
    a.download = `ThinkQuest_${safeTeamName}_${state.currentRound}_Scores.txt`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}