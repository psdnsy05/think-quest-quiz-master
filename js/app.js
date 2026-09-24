/**
 * THINK QUEST: CONTESTANT TERMINAL (FIREBASE CLIENT)
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
    resultSection: document.getElementById('question-result-section'),
    resultMessage: document.getElementById('q-result-message'),
    resultCorrectAns: document.getElementById('q-result-correct-ans'),
    resultExplanation: document.getElementById('q-result-explanation'),
    btnProtest: document.getElementById('btn-protest-result'),
    btnResolveProtest: document.getElementById('btn-resolve-protest'),
    btnCancelProtest: document.getElementById('btn-cancel-protest'),
    protestScreen: document.getElementById('protest-screen'),
    protestTeamAns: document.getElementById('protest-team-ans'),
    btnDownloadScores: document.getElementById('btn-download-scores')
};

function showScreen(screenId) {
    els.screens.forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    const activeScreen = document.getElementById(screenId);
    activeScreen.classList.remove('hidden');
    activeScreen.classList.add('active');
}

function initSecurity() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') || (e.ctrlKey && e.key.toLowerCase() === 'u')) e.preventDefault();
    });
    window.addEventListener('blur', () => {
        if (state.ignoreBlur) return;
        if (els.protestScreen && els.protestScreen.classList.contains('active')) return;
        if (state.inRound && !document.getElementById('security-screen').classList.contains('active')) {
            showScreen('security-screen');
            state.roundScore = 0;
            clearInterval(state.timerInterval);
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

// FIREBASE LISTENER: Automatically syncs terminal with Projector
function startFirebaseListener() {
    if (!window.db) return;
    
    window.onValue(window.ref(window.db, 'game/state'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.status === 'lobby') {
            if (state.inRound) endRound();
            else showScreen('lobby-screen');
        } 
        else if (data.status === 'ready') {
            if (state.currentRound !== data.round || state.questionIndex !== data.qIndex || !state.inRound) {
                state.currentRound = data.round;
                state.questionIndex = data.qIndex;
                if (!state.inRound) {
                    state.roundScore = 0;
                    state.questionsCorrect = 0;
                    state.roundHistory = [];
                    state.inRound = true;
                }
                loadQuestion();
            }
        } 
        else if (data.status === 'active') {
            if (els.readySection.classList.contains('hidden') === false) {
                revealQuestion();
            }
        } 
        else if (data.status === 'reveal') {
            if (!state.isLocked) lockAndGrade();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSecurity();
    
    // Hide manual start buttons in Lobby (Quiz Master controls flow now)
    const menuGrid = document.querySelector('.menu-grid');
    if (menuGrid) menuGrid.innerHTML = "<h3 style='color: var(--accent-gold); margin-top: 2rem;'>The Quiz Master will start the round shortly...</h3>";

    // Hide Next/Accept Result buttons on Question Screen (Controlled by Quiz Master)
    if (document.getElementById('btn-start-question')) document.getElementById('btn-start-question').classList.add('hidden');
    if (document.getElementById('btn-accept-result')) document.getElementById('btn-accept-result').classList.add('hidden');

    document.getElementById('btn-login').addEventListener('click', () => {
        const team = els.teamSelect.value;
        if (!team) { alert("Please select your team first."); return; }
        state.teamName = team;
        document.getElementById('lobby-team-name').textContent = team;
        document.getElementById('q-team-name').textContent = team;
        document.documentElement.requestFullscreen().catch(err => console.log(err));
        
        // Push team presence to Firebase
        if (window.db) window.set(window.ref(window.db, `teams/${team}`), { connected: true, score: 0 });
        
        showScreen('lobby-screen');
        startFirebaseListener();
    });

    els.btnProtest.addEventListener('click', () => {
        const q = state.activeData[state.currentRound][state.questionIndex];
        if (els.protestTeamAns) els.protestTeamAns.textContent = state.lastTeamAnsDisplay || "No Answer Submitted";
        if (document.getElementById('protest-official-ans')) {
            if (q.questionType === 'multiple-choice') document.getElementById('protest-official-ans').textContent = `${q.correctOption}. ${q.options[q.correctOption]}`;
            else document.getElementById('protest-official-ans').textContent = q.correctAnswer;
        }
        els.protestScreen.classList.remove('hidden');
        els.protestScreen.classList.add('active');
    });

    els.btnCancelProtest.addEventListener('click', () => {
        els.protestScreen.classList.remove('active');
        els.protestScreen.classList.add('hidden');
    });

    els.btnResolveProtest.addEventListener('click', () => {
        state.ignoreBlur = true;
        const pass = prompt("Proctor Password:");
        if (pass === null) { setTimeout(() => state.ignoreBlur = false, 1500); return; }
        
        if (pass === "thinkquest26") {
            const override = confirm("Did this team WIN the protest?\n\nClick OK to manually award points.");
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
        if (e.key === 'Enter' && !state.isLocked) { e.preventDefault(); els.idInput.blur(); }
    });

    document.getElementById('btn-return-lobby').addEventListener('click', () => showScreen('lobby-screen'));
    els.btnDownloadScores.addEventListener('click', downloadScoresheet);
});

function loadQuestion() {
    const q = state.activeData[state.currentRound][state.questionIndex];
    state.isLocked = false;
    state.selectedAnswer = null;
    
    els.resultSection.classList.add('hidden');
    els.readySection.classList.remove('hidden');
    els.activeQuestionSection.classList.add('hidden');
    
    document.getElementById('ready-q-num').textContent = `Question ${state.questionIndex + 1}`;
    els.mcOptions.forEach(b => { b.classList.remove('selected'); b.disabled = false; });
    els.idInput.value = "";
    els.idInput.disabled = false;

    document.getElementById('timer-status').textContent = "Waiting for Quiz Master...";
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
            if (q.options[l]) { document.querySelector(`[data-opt="${l}"]`).classList.remove('hidden'); el.textContent = q.options[l]; } 
            else document.querySelector(`[data-opt="${l}"]`).classList.add('hidden');
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
    if (q.questionType === 'identification') els.idInput.focus();
    startTimer(q.timeLimit);
}

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
    
    if (state.timer <= 3 && state.timer > 0) { d.classList.add('critical'); p.style.backgroundColor = "var(--critical-red)"; } 
    else { d.classList.remove('critical'); p.style.backgroundColor = "var(--accent-gold)"; }
}

function lockAndGrade() {
    if (state.isLocked) return;
    state.isLocked = true;
    clearInterval(state.timerInterval);
    document.getElementById('timer-status').textContent = "TIME'S UP! GRADING...";
    document.getElementById('timer-progress').style.width = "0%";
    
    els.mcOptions.forEach(b => b.disabled = true);
    els.idInput.disabled = true;

    const q = state.activeData[state.currentRound][state.questionIndex];
    let isCorrect = false;
    let teamAnsDisplay = "No Answer";
    let correctAnsDisplay = "";

    if (q.questionType === 'multiple-choice') {
        if (state.selectedAnswer === q.correctOption) isCorrect = true;
        if (state.selectedAnswer) teamAnsDisplay = `${state.selectedAnswer}. ${q.options[state.selectedAnswer]}`;
        correctAnsDisplay = `${q.correctOption}. ${q.options[q.correctOption]}`;
    } else {
        const rawInput = els.idInput.value.trim();
        state.selectedAnswer = rawInput.toLowerCase();
        teamAnsDisplay = rawInput || "No Answer";
        correctAnsDisplay = q.correctAnswer;
        
        const mainAns = q.correctAnswer.trim().toLowerCase();
        const altAns = q.acceptedAlternativeAnswers.map(a => a.trim().toLowerCase());
        if (state.selectedAnswer === mainAns || altAns.includes(state.selectedAnswer)) isCorrect = true;
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
    
    // Update score in Firebase instantly
    if (window.db) {
        window.set(window.ref(window.db, `teams/${state.teamName}/score`), state.roundScore);
        window.set(window.ref(window.db, `teams/${state.teamName}/lastAnswer`), teamAnsDisplay);
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

function endRound() {
    state.inRound = false; 
    document.getElementById('score-team-name').textContent = state.teamName;
    document.getElementById('score-points').textContent = state.roundScore;
    document.getElementById('score-breakdown').textContent = `${state.questionsCorrect} Correct / ${state.activeData[state.currentRound].length} Total`;
    
    const tbody = document.getElementById('review-table-body');
    tbody.innerHTML = "";
    
    state.roundHistory.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${log.qNum}</td><td class="${log.isCorrect ? 'td-correct' : 'td-incorrect'}">${log.teamAns}</td><td>${log.correctAns}</td><td>${log.ptsEarned} / ${log.maxPts}</td>`;
        tbody.appendChild(tr);
    });

    showScreen('score-screen');
}

function downloadScoresheet() {
    let content = `=======================================\nTHINK QUEST - OFFICIAL SCORESHEET\n=======================================\nTeam: ${state.teamName}\nRound: ${state.activeData[state.currentRound][0].roundTitle}\nTotal Points: ${state.roundScore}\nCorrect Answers: ${state.questionsCorrect} / ${state.activeData[state.currentRound].length}\n\nQUESTION BREAKDOWN:\n---------------------------------------\n`;
    state.roundHistory.forEach(log => {
        content += `Q${log.qNum}:\nTeam Answer: ${log.teamAns}\nCorrect Answer: ${log.correctAns}\nResult: ${log.isCorrect ? 'CORRECT' : 'INCORRECT'} (${log.ptsEarned} / ${log.maxPts} pts)\n---------------------------------------\n`;
    });
    content += `\nEnd of Report.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ThinkQuest_${state.teamName.replace(/[^a-z0-9]/gi, '_')}_${state.currentRound}_Scores.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}