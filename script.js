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

    // Conversión básica de Markdown a HTML seguro.
    function parseMarkdown(text) {
        if (!text) return "";
        let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // Formato básico de negrita y cursiva.
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
        
        // Listas con espaciado ajustado para legibilidad.
        html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<div style="margin-left: 15px; margin-bottom: 0px; line-height: 1.4;">• $1</div>');
        
        // Numeración con espaciado compacto.
        html = html.replace(/^\s*(\d+\.)\s+(.*)$/gm, '<div style="margin-top: 6px; margin-bottom: 0px; line-height: 1.4;"><b>$1</b> $2</div>');
        
        // Normaliza saltos de línea tras elementos de lista.
        html = html.replace(/<\/div>\s*\n/g, '</div>');
        
        // Convierte el resto de saltos de línea en <br>.
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }

    // Inicialización del widget y bindings.
    function initWidget() {
        const widgetHTML = `
        <button class="chat-toggler" onclick="toggleChat()">
            <svg class="icon-open" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"></path>
                <circle cx="8" cy="10" r="1.3" fill="white"></circle>
                <circle cx="12" cy="10" r="1.3" fill="white"></circle>
                <circle cx="16" cy="10" r="1.3" fill="white"></circle>
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

