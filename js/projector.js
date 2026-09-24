/**
 * THINK QUEST: PROJECTOR DISPLAY (FIREBASE HOST)
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

function initAudio() {
    if (!pState.audioContext) pState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (pState.audioContext.state === 'suspended') pState.audioContext.resume();
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

function updateFirebaseState(status) {
    if (!window.db) return;
    window.set(window.ref(window.db, 'game/state'), {
        round: pState.currentRound,
        qIndex: pState.questionIndex,
        status: status 
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-action="proj-round"]').forEach(btn => {
        btn.addEventListener('click', (e) => loadRound(e.currentTarget.dataset.round));
    });

    document.getElementById('btn-proj-home').addEventListener('click', () => {
        updateFirebaseState('lobby');
        showScreen('proj-home');
    });
    
    document.getElementById('btn-proj-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('btn-proj-next').addEventListener('click', () => navigate(1));
    document.getElementById('btn-proj-leaderboard').addEventListener('click', showLeaderboardScreen);
    document.getElementById('btn-lb-back').addEventListener('click', () => showScreen('proj-question'));
    document.getElementById('btn-menu-standings').addEventListener('click', showGrandFinalLeaderboard);
    document.getElementById('btn-menu-reset').addEventListener('click', resetAllScores);
    document.getElementById('btn-menu-adjust').addEventListener('click', manualScoreAdjustment);

    pEls.btnTimer.addEventListener('click', toggleTimer);
    pEls.btnReveal.addEventListener('click', revealAnswer);

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'f') {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
            else document.exitFullscreen();
        }
        if (document.getElementById('proj-question').classList.contains('active')) {
            if (key === ' ') { e.preventDefault(); toggleTimer(); }
            if (key === 'a') revealAnswer();
            if (key === 'arrowright') navigate(1);
            if (key === 'arrowleft') navigate(-1);
            if (key === 'escape') {
                updateFirebaseState('lobby');
                showScreen('proj-home');
            }
        }
    });
    
    updateFirebaseState('lobby');
});

function showScreen(id) {
    pEls.screens.forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
    if (pState.timerRunning) stopTimer();
}

function loadRound(roundId) {
    pState.currentRound = roundId;
    pState.questionIndex = 0;
    updateFirebaseState('ready');
    renderQuestion();
    showScreen('proj-question');
}

function renderQuestion() {
    const q = pState.activeData[pState.currentRound][pState.questionIndex];
    pState.answerRevealed = false;
    stopTimer();
    
    pState.timer = q.timeLimit;
    updateTimerUI();
    pEls.btnTimer.textContent = "Start Timer (Space)";
    pEls.btnReveal.classList.remove('hidden');
    pEls.revealContainer.classList.add('hidden');
    pEls.timerWrapper.classList.remove('hidden');

    ['A','B','C','D'].forEach(l => {
        document.getElementById(`proj-opt-${l}`).classList.remove('correct-reveal');
    });

    document.getElementById('proj-round-name').textContent = q.roundTitle;
    document.getElementById('proj-progress').textContent = `Question ${pState.questionIndex + 1} of ${pState.activeData[pState.currentRound].length}`;
    document.getElementById('proj-points').textContent = `${q.points} Points`;
    document.getElementById('proj-question-text').textContent = q.question;

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

function toggleTimer() {
    initAudio();
    if (pState.timerRunning) stopTimer();
    else startTimer();
}

function startTimer() {
    if (pState.timer <= 0 || pState.answerRevealed) return;
    pState.timerRunning = true;
    updateFirebaseState('active');
    pEls.btnTimer.textContent = "Pause (Space)";
    
    pState.timerInterval = setInterval(() => {
        pState.timer--;
        updateTimerUI();
        
        if (pState.timer <= 5 && pState.timer > 0) playTone(440, 'square', 0.2); 
        if (pState.timer <= 0) {
            playTone(880, 'square', 0.8);
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

function revealAnswer() {
    if (pState.answerRevealed) return; 
    stopTimer();
    pState.answerRevealed = true;
    updateFirebaseState('reveal'); 
    initAudio();
    playTone(600, 'sine', 0.4); 
    
    const q = pState.activeData[pState.currentRound][pState.questionIndex];
    
    pEls.timerWrapper.classList.add('hidden'); 
    pEls.revealContainer.classList.remove('hidden');
    pEls.btnReveal.classList.add('hidden');

    let correctVal = "";
    if (q.questionType === 'multiple-choice') {
        document.getElementById(`proj-opt-${q.correctOption}`).classList.add('correct-reveal');
        correctVal = q.correctOption.toUpperCase();
        document.getElementById('proj-correct-ans').textContent = `${q.correctOption}. ${q.options[q.correctOption]}`;
    } else {
        correctVal = q.correctAnswer.trim().toLowerCase();
        document.getElementById('proj-correct-ans').textContent = q.correctAnswer;
    }
    
    document.getElementById('proj-explanation').textContent = q.explanation;

    // Populate large Team Responses column from Firebase
    const resultsList = document.getElementById('proj-team-results-list');
    resultsList.innerHTML = "<p style='color: var(--text-muted); text-align: center; font-size: 1.5rem;'>Loading responses...</p>";

    if (window.db && window.ref && window.get) {
        window.get(window.ref(window.db, 'teams')).then((snapshot) => {
            resultsList.innerHTML = "";
            if (!snapshot.exists()) {
                resultsList.innerHTML = "<p style='color: var(--text-muted); text-align: center; font-size: 1.5rem;'>No teams connected.</p>";
                return;
            }

            const teamsData = snapshot.val();
            Object.keys(teamsData).forEach(teamName => {
                const teamInfo = teamsData[teamName];
                const teamAnsRaw = teamInfo.lastAnswer ? teamInfo.lastAnswer.toString() : "No Answer";
                
                let isCorrect = false;
                if (q.questionType === 'multiple-choice') {
                    if (teamAnsRaw.charAt(0).toUpperCase() === correctVal) isCorrect = true;
                } else {
                    const cleanAns = teamAnsRaw.trim().toLowerCase();
                    const altAns = q.acceptedAlternativeAnswers.map(a => a.trim().toLowerCase());
                    if (cleanAns === correctVal || altAns.includes(cleanAns)) isCorrect = true;
                }

                const teamRow = document.createElement('div');
                teamRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1.2rem; background: var(--bg-secondary); border-radius: 8px; font-size: 1.5rem;";
                teamRow.innerHTML = `
                    <span style="font-weight: bold; color: var(--text-main);">${teamName}</span>
                    <span style="color: var(--accent-gold); font-style: italic;">[ ${teamAnsRaw} ]</span>
                    <span style="font-weight: bold; padding: 0.2rem 0.8rem; border-radius: 4px; background: ${isCorrect ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)'}; color: ${isCorrect ? 'var(--correct-green)' : 'var(--critical-red)'};">
                        ${isCorrect ? '✔ CORRECT' : '✘ WRONG'}
                    </span>
                `;
                resultsList.appendChild(teamRow);
            });
        }).catch(() => {
            resultsList.innerHTML = "<p style='color: var(--critical-red); text-align: center; font-size: 1.5rem;'>Failed to load results.</p>";
        });
    }
}

function showLeaderboardScreen() {
    const lbBody = document.getElementById('lb-table-body');
    lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem;'>Calculating scores...</td></tr>";
    
    document.getElementById('lb-round-title').textContent = pState.currentRound ? pState.activeData[pState.currentRound][0].roundTitle : "Overall Leaderboard";
    showScreen('proj-leaderboard-screen');

    if (window.db && window.ref && window.get) {
        window.get(window.ref(window.db, 'teams')).then((snapshot) => {
            lbBody.innerHTML = "";
            if (!snapshot.exists()) {
                lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem; color: var(--text-muted);'>No team data recorded yet.</td></tr>";
                return;
            }

            const teamsData = snapshot.val();
            // Convert team object into a sortable array
            let sortedTeams = Object.keys(teamsData).map(name => {
                return { name: name, score: teamsData[name].score || 0 };
            });

            // Sort from highest score to lowest score
            sortedTeams.sort((a, b) => b.score - a.score);

            // Render leaderboard rows
            sortedTeams.forEach((team, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid var(--bg-secondary)";
                
                let rankBadge = `#${index + 1}`;
                let rowBg = "transparent";
                let textColor = "var(--text-main)";

                // Highlight Top 3 Podium spots
                if (index === 0) { rankBadge = "First Place"; rowBg = "rgba(241, 196, 15, 0.15)"; textColor = "var(--accent-gold)"; }
                else if (index === 1) { rankBadge = "Second Place"; rowBg = "rgba(189, 195, 199, 0.15)"; }
                else if (index === 2) { rankBadge = "Third Place"; rowBg = "rgba(211, 84, 0, 0.15)"; }

                tr.style.background = rowBg;
                tr.innerHTML = `
                    <td style="padding: 1.2rem; text-align: center; font-weight: bold; color: ${textColor};">${rankBadge}</td>
                    <td style="padding: 1.2rem; font-weight: bold; color: ${textColor};">${team.name}</td>
                    <td style="padding: 1.2rem; text-align: right; font-weight: bold; color: var(--accent-gold);">${team.score} pts</td>
                `;
                lbBody.appendChild(tr);
            });
        }).catch(() => {
            lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem; color: var(--critical-red);'>Error loading leaderboard.</td></tr>";
        });
    }
}

// Define the official progression order of rounds
const roundSequence = ['trial', 'round1', 'round2', 'round3', 'tieBreakers'];

function navigate(direction) {
    if (!pState.currentRound) return;
    const currentRoundQuestions = pState.activeData[pState.currentRound];
    const maxIndex = currentRoundQuestions ? currentRoundQuestions.length - 1 : 0;

    if (direction === 1) {
        if (pState.questionIndex < maxIndex) {
            // Move to next question within the same round
            pState.questionIndex++;
            updateFirebaseState('ready');
            renderQuestion();
        } else {
            // Reached the end of the round! Find the next round in sequence.
            const currentRoundIdx = roundSequence.indexOf(pState.currentRound);
            if (currentRoundIdx !== -1 && currentRoundIdx < roundSequence.length - 1) {
                const nextRoundId = roundSequence[currentRoundIdx + 1];
                // Check if the next round actually exists in the question data
                if (pState.activeData[nextRoundId] && pState.activeData[nextRoundId].length > 0) {
                    loadRound(nextRoundId); // Auto-advance to the next round!
                } else {
                    // If no more rounds exist, show Grand Final Leaderboard
                    showGrandFinalLeaderboard();
                }
            } else {
                // End of the very last round, show Grand Final Leaderboard
                showGrandFinalLeaderboard();
            }
        }
    } else if (direction === -1) {
        if (pState.questionIndex > 0) {
            pState.questionIndex--;
            updateFirebaseState('ready');
            renderQuestion();
        }
    }
}

function showGrandFinalLeaderboard() {
    updateFirebaseState('lobby');
    const lbBody = document.getElementById('lb-table-body');
    lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem;'>Calculating Final Championship Scores...</td></tr>";
    
    document.getElementById('lb-round-title').textContent = "OVERALL STANDINGS";
    showScreen('proj-leaderboard-screen');

    if (window.db && window.ref && window.get) {
        window.get(window.ref(window.db, 'teams')).then((snapshot) => {
            lbBody.innerHTML = "";
            if (!snapshot.exists()) {
                lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem; color: var(--text-muted);'>No team scores recorded.</td></tr>";
                return;
            }

            const teamsData = snapshot.val();
            let sortedTeams = Object.keys(teamsData).map(name => {
                return { name: name, score: teamsData[name].score || 0 };
            });

            // Sort from highest score to lowest score globally
            sortedTeams.sort((a, b) => b.score - a.score);

            sortedTeams.forEach((team, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid var(--bg-secondary)";
                
                let rankBadge = `#${index + 1}`;
                let rowBg = "transparent";
                let textColor = "var(--text-main)";

                if (index === 0) { rankBadge = "CHAMPION"; rowBg = "rgba(241, 196, 15, 0.25)"; textColor = "var(--accent-gold)"; }
                else if (index === 1) { rankBadge = "First Runner-up"; rowBg = "rgba(189, 195, 199, 0.15)"; }
                else if (index === 2) { rankBadge = "Second Runner-up"; rowBg = "rgba(211, 84, 0, 0.15)"; }

                tr.style.background = rowBg;
                tr.innerHTML = `
                    <td style="padding: 1.5rem; text-align: center; font-weight: bold; color: ${textColor}; font-size: 2rem;">${rankBadge}</td>
                    <td style="padding: 1.5rem; font-weight: bold; color: ${textColor}; font-size: 2rem;">${team.name}</td>
                    <td style="padding: 1.5rem; text-align: right; font-weight: bold; color: var(--accent-gold); font-size: 2rem;">${team.score} pts</td>
                `;
                lbBody.appendChild(tr);
            });
        }).catch(() => {
            lbBody.innerHTML = "<tr><td colspan='3' style='text-align: center; padding: 2rem; color: var(--critical-red);'>Error loading final standings.</td></tr>";
        });
    }
}

function resetAllScores() {
    const confirmation = prompt("⚠️ DANGER: This will wipe all team scores back to 0!\n\nType 'RESET' in all caps to confirm:");
    if (confirmation === "RESET") {
        if (window.db && window.ref && window.set) {
            // Fetch teams and reset their scores to 0 in Firebase
            window.get(window.ref(window.db, 'teams')).then((snapshot) => {
                if (snapshot.exists()) {
                    const teamsData = snapshot.val();
                    let updates = {};
                    Object.keys(teamsData).forEach(teamName => {
                        updates[`teams/${teamName}/score`] = 0;
                        updates[`teams/${teamName}/lastAnswer`] = "None";
                    });
                    window.set(window.ref(window.db, 'teams'), teamsData).then(() => {
                        // Alternatively, loop update scores
                        Object.keys(teamsData).forEach(teamName => {
                            window.set(window.ref(window.db, `teams/${teamName}/score`), 0);
                        });
                        alert("All scores have been successfully reset to 0.");
                    });
                } else {
                    alert("No teams found in database to reset.");
                }
            });
        }
    } else {
        alert("Reset cancelled.");
    }
}

function manualScoreAdjustment() {
    const pass = prompt("Proctor Password required for score adjustments:");
    if (pass !== "thinkquest26") {
        if (pass !== null) alert("Incorrect password.");
        return;
    }

    const teamName = prompt("Enter the exact Team Name you want to adjust (e.g., HRS 1C, PPG):");
    if (!teamName) return;

    if (window.db && window.ref && window.get) {
        window.get(window.ref(window.db, `teams/${teamName}`)).then((snapshot) => {
            if (!snapshot.exists()) {
                alert(`Team "${teamName}" not found in the database.`);
                return;
            }

            const currentScore = snapshot.val().score || 0;
            const newScoreInput = prompt(`Current score for ${teamName} is ${currentScore}.\n\nEnter the NEW total score (or type adjustment like +5 or -2):`);
            
            if (newScoreInput !== null) {
                let finalScore = currentScore;
                const trimmedInput = newScoreInput.trim();
                
                if (trimmedInput.startsWith('+')) {
                    finalScore = currentScore + parseInt(trimmedInput.substring(1)) || currentScore;
                } else if (trimmedInput.startsWith('-')) {
                    finalScore = currentScore - parseInt(trimmedInput.substring(1)) || currentScore;
                } else {
                    finalScore = parseInt(trimmedInput) || 0;
                }

                window.set(window.ref(window.db, `teams/${teamName}/score`), finalScore).then(() => {
                    alert(`Success! ${teamName}'s score has been updated to ${finalScore} pts.`);
                });
            }
        });
    }
}