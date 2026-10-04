const input = document.getElementById("notes");
const organizeBtn = document.getElementById("organizeBtn");
const resultsSection = document.getElementById("results");
const doNowContainer = document.getElementById("doNow");
const doSoonContainer = document.getElementById("doSoon");
const canWaitContainer = document.getElementById("canWait");
const next30Container = document.getElementById("next30");
const summaryElement = document.getElementById("summary");
const actionPanel = document.getElementById("actionPanel");
const actionTitle = document.getElementById("actionTitle");
const actionText = document.getElementById("actionDescription");
const startButton = document.getElementById("actionPrimary");
const copyButton = document.getElementById("actionSecondary");
const closeButton = document.getElementById("closeAction");
const resetButton = document.getElementById("resetBtn");
const startNextButton = document.getElementById("startNextBtn");

const voiceRecordBtn =
    document.getElementById("voiceRecordBtn");

const voiceStatus =
    document.getElementById("voiceStatus");

const voiceTranscript =
    document.getElementById("voiceTranscript");

const micIcon =
    document.getElementById("micIcon");

const languageSelect =
    document.getElementById("languageSelect");

let currentPlan = null;
let mediaRecorder = null;
let audioChunks = [];

let completedTasks = JSON.parse(
    localStorage.getItem("friendos_completed") || "[]"
);


function saveCompletedTasks() {
    localStorage.setItem(
        "friendos_completed",
        JSON.stringify(completedTasks)
    );
}


function isCompleted(taskId) {
    return completedTasks.includes(taskId);
}


function toggleCompleted(taskId) {
    if (isCompleted(taskId)) {
        completedTasks =
            completedTasks.filter(
                id => id !== taskId
            );
    } else {
        completedTasks.push(taskId);
    }

    saveCompletedTasks();
    renderPlan(currentPlan);
}


function escapeHtml(value) {
    const div =
        document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


function getTypeLabel(type) {
    const labels = {
        email: "communication",
        study: "study",
        writing: "next step",
        shopping: "shopping",
        travel: "travel",
        cleaning: "next step",
        research: "research",
        general: "next step"
    };

    return labels[type] || "next step";
}


function getActionLabel(type) {
    const labels = {
        email: "Draft →",
        study: "Study →",
        writing: "Start →",
        shopping: "Find →",
        travel: "Search →",
        cleaning: "Start →",
        research: "Research →",
        general: "Start →"
    };

    return labels[type] || "Start →";
}


function getAllTasks() {
    if (!currentPlan) {
        return [];
    }

    return [
        ...(currentPlan.do_now || []),
        ...(currentPlan.do_soon || []),
        ...(currentPlan.can_wait || [])
    ];
}


function findTask(taskId) {
    const allTasks = getAllTasks();

    if (!taskId) {
        return null;
    }

    return (
        allTasks.find(
            task => task.id === taskId
        ) || null
    );
}


function findTaskFromAction(item) {
    const allTasks = getAllTasks();

    if (item.task_id) {
        const exactTask =
            findTask(item.task_id);

        if (exactTask) {
            return exactTask;
        }
    }

    if (!item.action) {
        return null;
    }

    const actionText =
        item.action.toLowerCase();

    return (
        allTasks.find(task => {

            const title =
                (task.title || "").toLowerCase();

            return (
                title &&
                (
                    actionText.includes(title) ||
                    title.includes(actionText)
                )
            );
        }) || null
    );
}


function createTaskCard(task, number) {
    const completed =
        isCompleted(task.id);

    const card =
        document.createElement("div");

    card.className =
        `task-card ${
            completed ? "completed" : ""
        }`;

    card.innerHTML = `
        <div class="task-number">
            ${String(number).padStart(2, "0")}
        </div>

        <div class="task-content">

            <div class="task-title-row">

                <input
                    type="checkbox"
                    class="task-checkbox"
                    ${completed ? "checked" : ""}
                >

                <div class="task-title">
                    ${escapeHtml(task.title)}
                </div>

            </div>

            <div class="task-meta">

                <span>
                    ${escapeHtml(
                        getTypeLabel(task.type)
                    )}
                </span>

                ${
                    task.deadline &&
                    task.deadline !== "none"
                        ? `
                            <span>
                                • ${escapeHtml(
                                    task.deadline
                                )}
                            </span>
                        `
                        : ""
                }

                <span>
                    • ${task.estimated_minutes} min
                </span>

            </div>

            <div class="task-reason">
                ${escapeHtml(task.reason)}
            </div>

        </div>

        <button class="task-action">
            ${getActionLabel(task.type)}
        </button>
    `;

    const checkbox =
        card.querySelector(
            ".task-checkbox"
        );

    checkbox.addEventListener(
        "change",
        () => {
            toggleCompleted(task.id);
        }
    );

    const actionButton =
        card.querySelector(
            ".task-action"
        );

    actionButton.addEventListener(
        "click",
        () => {
            openAction(task);
        }
    );

    return card;
}


function renderTasks(container, tasks) {
    container.innerHTML = "";

    if (
        !tasks ||
        tasks.length === 0
    ) {
        container.innerHTML = `
            <div class="empty-task">
                Nothing here right now.
            </div>
        `;

        return;
    }

    tasks.forEach(
        (task, index) => {
            container.appendChild(
                createTaskCard(
                    task,
                    index + 1
                )
            );
        }
    );
}


function renderNext30(tasks) {
    next30Container.innerHTML = "";

    if (
        !tasks ||
        tasks.length === 0
    ) {
        next30Container.innerHTML = `
            <div class="empty-task">
                Start with one small thing.
            </div>
        `;

        return;
    }

    tasks.forEach(
        (item, index) => {

            const task =
                findTaskFromAction(item);

            const element =
                document.createElement("div");

            element.className =
                "next30-item";

            const title =
                task
                    ? task.title
                    : item.action ||
                      "Start with this next step";

            const action =
                item.action ||
                "Take the next small step.";

            element.innerHTML = `
                <span class="next30-number">
                    ${index + 1}
                </span>

                <div class="next30-content">

                    <strong>
                        ${escapeHtml(title)}
                    </strong>

                    <span>
                        ${escapeHtml(action)}
                    </span>

                </div>
            `;

            if (task) {
                element.addEventListener(
                    "click",
                    () => {
                        openAction(task);
                    }
                );
            }

            next30Container.appendChild(
                element
            );
        }
    );
}


function renderPlan(plan) {
    currentPlan = plan;

    renderTasks(
        doNowContainer,
        plan.do_now || []
    );

    renderTasks(
        doSoonContainer,
        plan.do_soon || []
    );

    renderTasks(
        canWaitContainer,
        plan.can_wait || []
    );

    renderNext30(
        plan.next_30_minutes || []
    );

    summaryElement.textContent =
        plan.summary || "";

    resultsSection.classList.remove(
        "hidden"
    );

    resultsSection.classList.add(
        "visible"
    );

    updateProgress();
}


function updateProgress() {
    if (!currentPlan) {
        return;
    }

    const allTasks =
        getAllTasks();

    const completedCount =
        allTasks.filter(
            task =>
                isCompleted(task.id)
        ).length;

    const progressElement =
        document.getElementById(
            "progressText"
        );

    if (progressElement) {
        progressElement.textContent =
            `${completedCount}/${allTasks.length} completed`;
    }
}


function openAction(task) {
    actionTitle.textContent =
        task.title;

    let message = "";

    if (task.type === "email") {

        message =
            "Start by drafting the email. FriendOS can help you turn your thoughts into a clear message.";

    } else if (task.type === "study") {

        message =
            "Start with a small study block. Break this into a focused session instead of trying to finish everything at once.";

    } else if (task.type === "writing") {

        message =
            "Open the assignment and take the smallest useful next step.";

    } else if (task.type === "shopping") {

        message =
            "Search for the item and compare a few options before buying.";

    } else if (task.type === "travel") {

        message =
            "Search the available travel options and choose the one that fits your plan.";

    } else if (task.type === "cleaning") {

        message =
            "Start with one small area instead of trying to clean everything.";

    } else if (task.type === "research") {

        message =
            "Start by finding the information you need to make the decision.";

    } else {

        message =
            "Take the smallest useful step toward completing this task.";
    }

    actionText.textContent =
        message;

    actionPanel.classList.add(
        "visible"
    );

    if (startButton) {
        startButton.onclick = () => {
            startTask(task);
        };
    }

    if (copyButton) {

        copyButton.onclick =
            async () => {

                try {

                    await navigator.clipboard.writeText(
                        task.title
                    );

                    copyButton.textContent =
                        "Copied ✓";

                    setTimeout(
                        () => {
                            copyButton.textContent =
                                "Copy";
                        },
                        1500
                    );

                } catch {

                    copyButton.textContent =
                        "Copy failed";
                }
            };
    }
}


function startTask(task) {

    if (task.type === "shopping") {

        const query =
            encodeURIComponent(
                task.title
            );

        window.open(
            `https://www.google.com/search?tbm=shop&q=${query}`,
            "_blank"
        );

        return;
    }


    if (task.type === "travel") {

        const query =
            encodeURIComponent(
                task.title
            );

        window.open(
            `https://www.google.com/search?q=${query}`,
            "_blank"
        );

        return;
    }


    if (task.type === "email") {

        const prompt =
            `Help me draft an email for this task: ${task.title}`;

        navigator.clipboard.writeText(
            prompt
        );

        window.open(
            "https://mail.google.com/",
            "_blank"
        );

        return;
    }


    if (task.type === "study") {

        const prompt =
            `Create a focused study plan for this task: ${task.title}`;

        navigator.clipboard.writeText(
            prompt
        );

        window.open(
            "https://gemini.google.com/",
            "_blank"
        );

        return;
    }


    if (task.type === "writing") {

        const prompt =
            `Help me break this writing task into small steps: ${task.title}`;

        navigator.clipboard.writeText(
            prompt
        );

        window.open(
            "https://gemini.google.com/",
            "_blank"
        );

        return;
    }


    if (task.type === "research") {

        const query =
            encodeURIComponent(
                task.title
            );

        window.open(
            `https://www.google.com/search?q=${query}`,
            "_blank"
        );

        return;
    }


    if (task.type === "cleaning") {

        const prompt =
            `Create a simple cleaning checklist for: ${task.title}`;

        navigator.clipboard.writeText(
            prompt
        );

        window.open(
            "https://gemini.google.com/",
            "_blank"
        );

        return;
    }


    navigator.clipboard.writeText(
        task.title
    );

    alert(
        "Task copied. Start with the smallest possible step."
    );
}


function getNextIncompleteTask() {
    const tasks =
        getAllTasks();

    return (
        tasks.find(
            task =>
                !isCompleted(task.id)
        ) || null
    );
}


async function organizeNotes(notes) {

    const response =
        await fetch(
            "/api/organize",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    notes: notes,
                    language:
                        languageSelect
                            ? languageSelect.value
                            : "English"
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail ||
            "Something went wrong."
        );
    }

    renderPlan(data);

    resultsSection.scrollIntoView({
        behavior: "smooth"
    });
}


organizeBtn.addEventListener(
    "click",
    async () => {

        const notes =
            input.value.trim();

        if (!notes) {
            input.focus();
            return;
        }

        organizeBtn.disabled =
            true;

        organizeBtn.textContent =
            "Thinking...";

        try {

            await organizeNotes(
                notes
            );

        } catch (error) {

            alert(
                error.message
            );

        } finally {

            organizeBtn.disabled =
                false;

            organizeBtn.textContent =
                "Organize my life →";
        }
    }
);


if (startNextButton) {

    startNextButton.addEventListener(
        "click",
        () => {

            const task =
                getNextIncompleteTask();

            if (task) {
                openAction(task);
            }
        }
    );
}


if (closeButton) {

    closeButton.addEventListener(
        "click",
        () => {

            actionPanel.classList.remove(
                "visible"
            );
        }
    );
}


if (resetButton) {

    resetButton.addEventListener(
        "click",
        () => {

            input.value = "";

            currentPlan = null;

            resultsSection.classList.remove(
                "visible"
            );

            resultsSection.classList.add(
                "hidden"
            );

            actionPanel.classList.remove(
                "visible"
            );

            voiceTranscript.textContent =
                "";

            voiceTranscript.classList.add(
                "hidden"
            );

            voiceStatus.textContent =
                "Type normally or tap the microphone to speak.";

            voiceRecordBtn.classList.remove(
                "recording"
            );

            micIcon.textContent =
                "🎙️";

            input.focus();
        }
    );
}


if (voiceRecordBtn) {

    voiceRecordBtn.addEventListener(
        "click",
        async () => {

            if (
                mediaRecorder &&
                mediaRecorder.state ===
                    "recording"
            ) {

                mediaRecorder.stop();

                return;
            }


            try {

                const stream =
                    await navigator.mediaDevices.getUserMedia({
                        audio: true
                    });

                audioChunks = [];


                let mimeType =
                    "audio/webm";


                if (
                    MediaRecorder.isTypeSupported(
                        "audio/webm;codecs=opus"
                    )
                ) {

                    mimeType =
                        "audio/webm;codecs=opus";
                }


                mediaRecorder =
                    new MediaRecorder(
                        stream,
                        {
                            mimeType:
                                mimeType
                        }
                    );


                mediaRecorder.ondataavailable =
                    event => {

                        if (
                            event.data.size >
                            0
                        ) {

                            audioChunks.push(
                                event.data
                            );
                        }
                    };


                mediaRecorder.onstop =
                    async () => {

                        stream
                            .getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );


                        const audioBlob =
                            new Blob(
                                audioChunks,
                                {
                                    type:
                                        mediaRecorder.mimeType
                                }
                            );


                        voiceRecordBtn.disabled =
                            true;

                        voiceStatus.textContent =
                            "Transcribing...";

                        micIcon.textContent =
                            "⏳";


                        try {

                            const formData =
                                new FormData();

                            formData.append(
                                "audio",
                                audioBlob,
                                "friendos-voice.webm"
                            );


                            const response =
                                await fetch(
                                    "/api/transcribe",
                                    {
                                        method:
                                            "POST",

                                        body:
                                            formData
                                    }
                                );


                            const data =
                                await response.json();


                            if (!response.ok) {

                                throw new Error(
                                    data.detail ||
                                    "Transcription failed."
                                );
                            }


                            input.value =
                                data.text;


                            voiceTranscript.textContent =
                                data.text;

                            voiceTranscript.classList.remove(
                                "hidden"
                            );


                            voiceStatus.textContent =
                                "Organizing your thoughts...";


                            await organizeNotes(
                                data.text
                            );


                            voiceStatus.textContent =
                                "Done.";

                        } catch (error) {

                            console.error(
                                error
                            );

                            voiceStatus.textContent =
                                error.message ||
                                "Something went wrong.";

                        } finally {

                            voiceRecordBtn.disabled =
                                false;

                            voiceRecordBtn.classList.remove(
                                "recording"
                            );

                            micIcon.textContent =
                                "🎙️";
                        }
                    };


                mediaRecorder.start();


                voiceRecordBtn.classList.add(
                    "recording"
                );


                micIcon.textContent =
                    "🔴";


                voiceStatus.textContent =
                    "Listening... Tap the mic again when you're done.";

            } catch (error) {

                console.error(
                    error
                );

                voiceStatus.textContent =
                    "Microphone access was not available.";
            }
        }
    );
}