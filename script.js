(function() {
    // Inicialización de configuración del widget.
    const SCRIPT_URL = document.currentScript.src;
    const ASSET_BASE = SCRIPT_URL.substring(0, SCRIPT_URL.lastIndexOf('/'));

    // Resolver la URL del backend a partir del script o data-api.
    const rawApi = document.currentScript.getAttribute('data-api');
    let API_URL = rawApi ? rawApi.replace(/\/+$/, '') : "";
    if (!API_URL && SCRIPT_URL.includes('/widget/')) {
        API_URL = SCRIPT_URL.substring(0, SCRIPT_URL.indexOf('/widget'));
    }

    const MAX_MESSAGE_CHARS = 120;

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function renderInlineMarkdown(text) {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        html = html.replace(/\*(?!\*)(.+?)\*(?!\*)/g, '<i>$1</i>');
        return html;
    }

    // Conversión de Markdown ligero respetando saltos de párrafo y niveles de lista.
    function parseMarkdown(text) {
        if (!text) return "";

        const lines = text.replace(/\r\n?/g, "\n").split("\n");
        const chunks = [];

        for (const line of lines) {
            if (!line.trim()) {
                chunks.push('<div class="md-blank"></div>');
                continue;
            }

            const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
            if (bulletMatch) {
                const indentSpaces = bulletMatch[1].replace(/\t/g, "    ").length;
                const level = Math.floor(indentSpaces / 2);
                const marginLeft = 14 + (level * 14);
                chunks.push(
                    `<div class="md-list-item" style="margin-left:${marginLeft}px;">• ${renderInlineMarkdown(bulletMatch[2])}</div>`
                );
                continue;
            }

            const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
            if (orderedMatch) {
                const indentSpaces = orderedMatch[1].replace(/\t/g, "    ").length;
                const level = Math.floor(indentSpaces / 2);
                const marginLeft = 14 + (level * 14);
                chunks.push(
                    `<div class="md-list-item" style="margin-left:${marginLeft}px;"><b>${orderedMatch[2]}.</b> ${renderInlineMarkdown(orderedMatch[3])}</div>`
                );
                continue;
            }

            chunks.push(`<div class="md-line">${renderInlineMarkdown(line)}</div>`);
        }

        return chunks.join("");
    }

    // Inicialización del widget y bindings.
    function initWidget() {
        const widgetHTML = `
        <button class="chat-toggler" onclick="toggleChat()">
            <svg class="icon-open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5 4H19C20.6569 4 22 5.34315 22 7V14C22 15.6569 20.6569 17 19 17H11L6 20V17H5C3.34315 17 2 15.6569 2 14V7C2 5.34315 3.34315 4 5 4Z" fill="white"/>
                <circle cx="9" cy="10.5" r="1.2" fill="#4B5563"></circle>
                <circle cx="12.5" cy="10.5" r="1.2" fill="#4B5563"></circle>
                <circle cx="16" cy="10.5" r="1.2" fill="#4B5563"></circle>
            </svg>
            <svg class="icon-close" style="display: none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="chat-widget" id="chat-widget">
            <div class="chat-header">
                <div class="header-info">
                    <h3>Sala Girasol 🌻</h3>
                    <p id="chat-status">En línea | Respuesta inmediata</p>
                </div>
                <button class="close-btn" onclick="toggleChat()">×</button>
            </div>
            <div class="chat-body" id="chat-box">
                <div class="message bot">
                    <div class="bubble">👋 ¡Hola! Soy el asistente virtual.<br>Puedo ayudarte con la <b>cartelera</b> o hacer una <b>reserva</b>.</div>
                </div>
            </div>
            <div class="chat-footer">
                <div class="input-wrapper">
                    <input type="text" id="user-input" placeholder="Escribe tu mensaje..." autocomplete="off" maxlength="${MAX_MESSAGE_CHARS}">
                    <span class="char-counter" id="char-counter">0/${MAX_MESSAGE_CHARS}</span>
                </div>
                <button id="send-btn"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg></button>
            </div>
        </div>
        `;
        
        // Inyecta el HTML cuando los estilos están disponibles.
        document.body.insertAdjacentHTML('beforeend', widgetHTML);

        // Lógica de interacción y estado.
        window.toggleChat = function() {
            document.body.classList.toggle('show-chat');
        };

        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        const charCounter = document.getElementById('char-counter');
        const chatStatus = document.getElementById('chat-status');
        userInput.setAttribute('maxlength', MAX_MESSAGE_CHARS);
        let history = [];
        let backendReady = false;
        const conversationId = (window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        function updateCounter() {
            if (userInput.value.length > MAX_MESSAGE_CHARS) {
                userInput.value = userInput.value.slice(0, MAX_MESSAGE_CHARS);
            }
            charCounter.textContent = `${userInput.value.length}/${MAX_MESSAGE_CHARS}`;
        }

        function addMessage(role, text) {
            const div = document.createElement('div');
            div.className = `message ${role}`;
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            
            if (role === 'bot') {
                bubble.innerHTML = parseMarkdown(text);
            } else {
                bubble.textContent = text; 
            }
            
            div.appendChild(bubble);
            chatBox.appendChild(div);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function setBackendState(isReady) {
            backendReady = isReady;
            userInput.disabled = !isReady;
            sendBtn.disabled = !isReady;
            chatStatus.textContent = isReady ? "En línea | Respuesta inmediata" : "Activando el chat...";
        }

        async function pingBackend() {
            if (!API_URL) {
                setBackendState(false);
                addMessage('bot', '⚠️ Falta configurar la URL del servidor.');
                return;
            }
            try {
                // Ping con no-cors para evitar errores de red en local.
                await fetch(`${API_URL}/`, { method: 'GET', cache: 'no-store', mode: 'no-cors' });
                setBackendState(true);
            } catch (e) {
                setBackendState(false);
                setTimeout(pingBackend, 5000);
            }
        }

        async function sendMessage() {
            if (!backendReady) {
                addMessage('bot', '⏳ Estoy activandome, dame unos segundos y prueba otra vez.');
                return;
            }
            const text = userInput.value.trim();
            if (!text) return;

            addMessage('user', text);
            userInput.value = '';
            updateCounter();
            history.push({ role: "user", content: text });

            const loadingId = "loading-" + Date.now();
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message bot';
            loadingDiv.innerHTML = `<div class="bubble"><span id="${loadingId}">Pensando... 🌻</span></div>`;
            chatBox.appendChild(loadingDiv);
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const response = await fetch(`${API_URL}/api/v1/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: history,
                        conversation_id: conversationId
                    })
                });
                
                // Elimina el mensaje de carga.
                loadingDiv.remove();

                if (!response.ok) throw new Error('Error API');
                const data = await response.json();
                
                addMessage('bot', data.reply);
                history.push({ role: "assistant", content: data.reply });

            } catch (e) {
                console.error(e);
                loadingDiv.remove();
                addMessage('bot', '⚠️ Error de conexion.');
            }
        }

        // Listeners de eventos.
        sendBtn.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        userInput.addEventListener('input', updateCounter);
        updateCounter();

        // Inicialización del estado.
        setBackendState(false);
        pingBackend();
    }

    // Carga de estilos del widget.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const cacheBuster = SCRIPT_URL.includes('?') ? SCRIPT_URL.split('?')[1] : `v=${Date.now()}`;
    link.href = `${ASSET_BASE}/style.css?${cacheBuster}`;
    
    // Inicia el widget cuando el CSS ha cargado.
    link.onload = initWidget; 
    link.onerror = initWidget; // Si falla, se muestra igualmente (fallback).
    
    document.head.appendChild(link);

})();
