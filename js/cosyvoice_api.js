class Cosyvoice {
    constructor(wssUrl, voice_id, model_name) {
        this.wssUrl = wssUrl;
        this.socket = null;
        this.taskId = null;
        this.isConnected = false;
        this.isTaskStarted = false;
        this.isTaskFinished = false;
        this.messageQueue = [];
        this.resolveTaskStarted = null;
        this.resolveTaskFinished = null;
        this.voice_id = voice_id;
        this.model_name = model_name;
    }

    // 连接到 WebSocket 服务并发送 run-task 消息
    connect(callback) {
        return new Promise((resolve, reject) => {
            this.resolveTaskStarted = resolve;
            this.socket = new WebSocket(this.wssUrl);
            this.socket.binaryType = "arraybuffer";

            this.socket.onopen = () => {
                console.log("WebSocket connection established.");
                this.isConnected = true;

                // 生成随机任务 ID
                this.taskId = this.generateUUID();

                // 发送 run-task 消息
                const runTaskMessage = {
                    header: {
                        action: "run-task",
                        task_id: this.taskId,
                        streaming: "duplex"
                    },
                    payload: {
                        task_group: "audio",
                        task: "tts",
                        function: "SpeechSynthesizer",
                        model: this.model_name,
                        parameters: {
                            text_type: "PlainText",
                            voice: this.voice_id,      // 音色
                            format: "pcm",		        // 音频格式
                            sample_rate: 16000,	        // 采样率
                            volume: 50,			        // 音量
                            rate: 1,				    // 语速
                            pitch: 1				    // 音调
                        },
                        "input": {}
                    }
                };

                this.socket.send(JSON.stringify(runTaskMessage));
                // console.log('send message: ', runTaskMessage)
            };

            this.socket.onmessage = (event) => {
                const data = event.data;
                if (typeof data === 'string') {
                    const message = JSON.parse(data);
                    // console.log("Received message:", message);

                    if (message.header.event === "task-started") {
                        this.isTaskStarted = true;
                        this.isTaskFinished = false;
                        console.log('recv task-started');
                        if (this.resolveTaskStarted) {
                            this.resolveTaskStarted();
                        }
                        resolve(); // 在接收到 task-started 后 resolve Promise
                    } else if (message.header.event === "task-finished") {
                        console.log('recv task-finished');
                        this.isTaskFinished = true;
                        if (this.resolveTaskFinished) {
                            this.resolveTaskFinished();
                        }
                    }
                } else if (data instanceof ArrayBuffer) {
                    console.log("recv PCM audio size (bytes): ", data.byteLength);
                    callback(data);
                }
            };

            this.socket.onerror = (error) => {
                console.error("WebSocket error:", error);
                reject(error); // 如果发生错误，reject Promise
            };

            this.socket.onclose = () => {
                console.log("WebSocket connection closed.");
                this.isConnected = false;
                this.isTaskStarted = false;
                if (!this.isTaskStarted) {
                    reject(new Error("WebSocket closed before task started."));
                }
            };
        });
    }

    // 发送音频数据
    sendText(text_chunk) {
        if (!this.isConnected || !this.isTaskStarted) {
            throw new Error("WebSocket is not connected or task has not started.");
        }
        const continueTaskMessage = {
            header: {
                action: "continue-task",
                task_id: this.taskId,
                streaming: "duplex"
            },
            payload: {
                input: {
                    text: text_chunk
                }
            }
        };

        this.socket.send(JSON.stringify(continueTaskMessage));
    }

    // 停止任务并等待 task-finished 消息
    stop() {
        if (!this.isConnected || !this.isTaskStarted) {
            throw new Error("WebSocket is not connected or task has not started.");
        }
        const finishTaskMessage = {
            header: {
                action: "finish-task",
                task_id: this.taskId,
                streaming: "duplex"
            },
            payload: {
                input: {}
            }
        };

        this.socket.send(JSON.stringify(finishTaskMessage));
        console.log('send message: ', finishTaskMessage)

        return new Promise((resolve, reject) => {
            this.resolveTaskFinished = resolve;
        });
    }

    // 关闭 WebSocket 连接
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    // 生成随机 UUID
    generateUUID() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}
// 暴露到全局环境
window.Cosyvoice = Cosyvoice;