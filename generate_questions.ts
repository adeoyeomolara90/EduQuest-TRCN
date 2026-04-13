import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const topics = [
    "English and Communication Skills",
    "Basic Mathematics",
    "History of Education",
    "Educational Technology and ICT",
    "Teaching Profession",
    "Curriculum Studies",
    "Philosophy of Education",
    "Child Friendly Schools",
    "Measuring and Evaluation",
    "Educational Psychology",
    "Sociology and Education",
    "Education of Special Target Group/Adult Education",
    "Educational Research",
    "Statistics",
    "The Use of Library",
    "Educational Management",
    "Micro Teaching",
    "Special Education",
    "Guidance and Counselling",
    "Classroom Management",
    "Comparative Education",
    "Teacher Education",
    "Subject Methodology",
    "Current Affairs"
];

async function generate() {
    console.log("Generating more questions...");
    let allNewQuestions = [];
    
    for (const topic of topics) {
        process.stdout.write(`Generating for ${topic}... `);
        const prompt = `Generate 10 multiple-choice questions for a professional teaching exam (like TRCN) on the topic: ${topic}. 
        IMPORTANT: For "Current Affairs", ensure the questions are up to date as of 2026 (current year). 
        Return ONLY a JSON array of objects with the following structure:
        [
          {
            "text": "question text",
            "options": ["option A", "option B", "option C", "option D"],
            "correctAnswer": 0,
            "topic": "${topic}",
            "explanation": "brief explanation"
          }
        ]`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const text = response.text || "";
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const questions = JSON.parse(jsonMatch[0]);
                allNewQuestions.push(...questions);
                console.log(`Done (${questions.length})`);
            } else {
                console.log("Failed (No JSON found)");
            }
        } catch (error) {
            console.log(`Failed (${error})`);
        }
    }

    console.log(`Total generated: ${allNewQuestions.length}`);
    
    if (allNewQuestions.length === 0) return;

    const filePath = 'src/data/trcn_questions.ts';
    let content = fs.readFileSync(filePath, 'utf8');
    
    const countMatch = content.match(/trcn_(\d+)/g);
    let lastCount = countMatch ? Math.max(...countMatch.map(m => parseInt(m.split('_')[1]))) : 0;
    
    let newEntries = allNewQuestions.map(q => {
        lastCount++;
        return `  {
    id: 'trcn_${lastCount}',
    text: ${JSON.stringify(q.text)},
    options: ${JSON.stringify(q.options)},
    correctAnswer: ${q.correctAnswer},
    topic: ${JSON.stringify(q.topic)},
    explanation: ${JSON.stringify(q.explanation)}
  }`;
    }).join(',\n');

    content = content.replace(/\];\s*$/, `,\n${newEntries}\n];`);
    fs.writeFileSync(filePath, content);
    console.log("Updated trcn_questions.ts");
}

generate().catch(console.error);
