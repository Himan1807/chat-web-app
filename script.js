const http = require('http');
const WebSocket = require('ws');

let chatHistory = [];

let clients = new Map();

const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/favicon.png') {
        const faviconPath = path.join(__dirname, 'favicon.png');
        fs.readFile(faviconPath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'image/x-icon' });
                res.end(data);
            }
        });
        return;
    }
    const my_html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Let's Chat</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="shortcut icon" href="/favicon.png" type="image/x-icon">

    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            background-image: url('https://images.pexels.com/photos/1834399/pexels-photo-1834399.jpeg');
            background-repeat: no-repeat;
            background-size: cover;
            background-attachment: fixed;
            background-position: center;
        }

        body::before{
            content:'';
            position: fixed;
            top: 0; 
            left: 0; 
            right: 0; 
            bottom: 0;
            background: rgba(0, 0, 0, 0.7); 
            z-index: -1;
        }
        
        #header {
            display: flex;
            justify-content: space-between;
            text-align: center;
        }
        
        h1 {
            color: #2b2b2b;
        }
        
        #messages {
            border: none;
            border-radius: 10px;
            height: 400px;
            overflow-y: auto;
            background: #fafafa;
            padding: 10px 15px;
            margin-top: 10px;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(5px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message {
            margin: 5px 0;
            animation: fadeIn 0.3s ease-out;
        }
        
        .message .username {
            font-weight: bold;
            margin-right: 5px;
        }
        
        .my-message {
            background: #d0f0c0;
            padding: 5px 15px;
            border-radius: 20px 20px 0 20px;
            margin: 8px 0;
            max-width: 75%;
        }
        
        .other-message {
            background: #e6e6e6;
            padding: 5px 15px;
            border-radius: 20px 20px 20px 0;
            margin: 8px 0;
            max-width: 75%;
        }
        
        .system-message {
            color: #999;
            font-style: italic;
            margin: 5px 0;
        }
        
        #typingIndicator {
            font-size: 12px;
            color: #999;
            height: 20px;
        }
        
        #searchInput {
            border: 1px solid #ccc;
            padding: 8px 12px;
            width: 200px;
            border-radius: 20px;
            outline: none;
        }
        
        #inputBox {
            margin-top: 10px;
            display: flex;
            align-items: center;
            background: #fff;
            padding: 10px;
            border-radius: 30px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        #msgInput {
            flex: 1;
            padding: 10px 15px;
            border: none;
            outline: none;
            border-radius: 30px;
        }
        
        #sendBtn {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            margin-left: 10px;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        #sendBtn:hover {
            background-color: #43a047;
        }
        
        .chat-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        #sendBtn i {
            pointer-events: none;
        }

        .search-container {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #fff;
            padding: 5px 10px;
            border-radius: 20px;
            border: 1px solid #ccc;
        }
        
        .search-container i {
            color: #888;
        }
        
        .search-container input {
            border: none;
            outline: none;
            flex: 1;
        }

    </style>
</head>
<body>
    <div class="chat-container">
        <div id="header">
            <h1>Let's Chat</h1>
            <div class="search-container">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" placeholder="Search messages...">
            </div>
        </div>

        <div id="messages"></div>
        <div id="typingIndicator"></div>
        <div id="inputBox">
            <input type="text" id="msgInput" placeholder="Type here...">
            <button id="sendBtn"><i class="fas fa-paper-plane"></i></button>

        </div>
    </div>
    <script>
        let username = '';
        while (!username || username.trim() === '') {
            username = prompt("Enter your username: ");
        }
        username = username.trim();

        const msgDiv = document.getElementById('messages');
        const my_input = document.getElementById('msgInput');
        const my_button = document.getElementById('sendBtn');
        const searchInput = document.getElementById('searchInput');
        const typingIndicator = document.getElementById('typingIndicator');

        let chatHistory = [];
        let isFocused = true;
        let typingTimeout;
        let currentlyTypingUsers = new Set();

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // const my_ws = new WebSocket('ws://' + location.host);
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const my_ws = new WebSocket('\${protocol}//' + location.host);

        my_ws.addEventListener('open', () => {
            my_ws.send(JSON.stringify({
                type: 'username',
                username
            }));
        });

        my_ws.addEventListener('message', (my_event) => {
            const data = JSON.parse(my_event.data);
            if (data.type === 'chatHistory') {
                chatHistory = data.messages;
                renderMessages(chatHistory);
            } else if (data.type === 'chat' || data.type === 'system') {
                chatHistory.push(data);
                appendMessage(data)
                if (!isFocused && data.type === 'chat' && data.username !== username && Notification.permission === 'granted') {
                    new Notification("New message from " + data.username, {
                        body: data.text
                    });
                }
            } else if (data.type === 'typing') {
                const {
                    user,
                    isTyping
                } = data;
                if (isTyping) {
                    currentlyTypingUsers.add(user);
                } else {
                    currentlyTypingUsers.delete(user);
                }
                updateTypingIndicator();
            }
        });

        // Filter messages based on search input
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = chatHistory.filter(msg => 
                msg.type === 'system' || 
                (msg.username && msg.username.toLowerCase().includes(query)) || 
                (msg.text && msg.text.toLowerCase().includes(query))
            );
            renderMessages(filtered);
        });

        my_button.addEventListener('click', sendMessage);

        my_input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            } else {
                sendTypingStatus();
            }
        });

        my_input.addEventListener('focus', sendTypingStatus);
        my_input.addEventListener('blur', sendTypingStatus);

        window.addEventListener('focus', () => {
            isFocused = true;
        });
        window.addEventListener('blur', () => {
            isFocused = false;
        });

        function sendMessage() {
            const text = my_input.value.trim();
            if (text) {
                my_ws.send(JSON.stringify({
                    type: 'chat',
                    text
                }));
                my_input.value = '';
                sendTypingStatus(false);
            }
        }

        function sendTypingStatus(isTyping = true) {
            clearTimeout(typingTimeout); 
            my_ws.send(JSON.stringify({
                type: 'typing',
                isTyping
            }));
            if (isTyping) {
                typingTimeout = setTimeout(() => {
                    my_ws.send(JSON.stringify({
                        type: 'typing',
                        isTyping: false
                    }));
                }, 3000);
            }
        }

        function appendMessage(msg) {
            const my_div = document.createElement('div');
            my_div.classList.add('message');

            if (msg.type === 'system') {
                my_div.classList.add('system-message');
                my_div.textContent = msg.text;
            } else {
                const usernameSpan = document.createElement('span');
                usernameSpan.classList.add('username');
                usernameSpan.textContent = msg.username + ":";

                const textSpan = document.createElement('span');
                textSpan.textContent = ' ' + msg.text;
                
                if (msg.username === username) {
                    textSpan.classList.add('my-message');
                    } else {
                        textSpan.classList.add('other-message');
                }
                
                my_div.appendChild(usernameSpan);
                my_div.appendChild(textSpan);
            }
            msgDiv.appendChild(my_div);
            msgDiv.scrollTop = msgDiv.scrollHeight;
        }

        function renderMessages(messages) {
            msgDiv.innerHTML = '';
            messages.forEach(m => appendMessage(m));
        }

        function updateTypingIndicator() {
            if (currentlyTypingUsers.size === 0) {
                typingIndicator.textContent = ''
            } else {
                typingIndicator.textContent = Array.from(currentlyTypingUsers).join(', ') + ' is typing...';
            }
        }
    </script>
</body>

</html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(my_html);
});

const wss = new WebSocket.Server({ server });

function broadcast(msgObj) {
    const data = JSON.stringify(msgObj);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

wss.on('connection', (my_ws) => {
    let my_user = { username: null };
    clients.set(my_ws, my_user);

    my_ws.send(JSON.stringify({ type: 'chatHistory', messages: chatHistory }));

    my_ws.on('message', (my_message) => {
        let data;
        try {
            data = JSON.parse(my_message);
        } catch (e) {
            return;
        }

        if (data.type === 'username') {
            my_user.username = data.username;

            const joinMsg = {
                type: 'system',
                text: my_user.username + " has joined the chat.",
                timestamp: Date.now()
            };
            chatHistory.push(joinMsg);
            broadcast(joinMsg);
        } else if (data.type === 'chat') {
            if (!my_user.username) {
                return;
            }
            const chatMsg = {
                type: 'chat',
                username: my_user.username,
                text: data.text,
                timestamp: Date.now()
            };
            chatHistory.push(chatMsg);
            broadcast(chatMsg);
        } else if (data.type === 'typing') {
            if (!my_user.username) {
                return;
            }
            broadcast({
                type: 'typing',
                user: my_user.username,
                isTyping: data.isTyping
            });
        }
    });

    my_ws.on('close', () => {
        const leavingUser = my_user.username;
        clients.delete(my_ws);
        if (leavingUser) {
            const leaveMsg = {
                type: 'system',
                text: leavingUser + " has left the chat.",
                timestamp: Date.now()
            };
            chatHistory.push(leaveMsg);
            broadcast(leaveMsg);
        }
    });
});

// server.listen(3000, () => {
//     console.log("Chat server running at http://localhost:3000");
// })

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});