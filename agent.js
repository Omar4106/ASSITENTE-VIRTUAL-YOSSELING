const fs = require('fs');
const path = require('path');

const API_URL = process.env.FREELLMAPI_BASE_URL || 'http://localhost:3001/v1/chat/completions';
const API_KEY = process.env.FREELLMAPI_KEY || 'freellmapi-b537182da0b60777fb306fcc6ac138a20049b35e8b5905ef';

async function callLLM(messages) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: 'auto',
            messages: messages,
            stream: false
        })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function runAgentTask(userPrompt) {
    console.log("🤖 [Yosseling Agent] Analizando proyecto...");
    
    let messages = [
        { 
          role: 'system', 
          content: `Eres un agente autónomo de desarrollo experto en Next.js, TypeScript y Tailwind CSS. 
Para modificar o leer archivos, responde DIRECTAMENTE con bloques de código o instrucciones claras que el usuario pueda aplicar, o modifica los archivos si tienes la capacidad. 
Tu objetivo actual es implementar una vista de pantalla dividida (split screen) al 50% (Chat / Workspace) estilo Bolt en app/page.tsx.` 
        },
        { role: 'user', content: userPrompt }
    ];

    const reply = await callLLM(messages);
    console.log("\n✨ Respuesta del Agente:\n", reply);
}

const argPrompt = process.argv.slice(2).join(' ');
if (argPrompt) {
    runAgentTask(argPrompt);
} else {
    console.log("Uso: node agent.js 'Tu instrucción aquí'");
}
