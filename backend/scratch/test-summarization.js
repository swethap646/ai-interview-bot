require('dotenv').config();
const { chatWithAI } = require('../src/services/aiService');

async function testSummarization() {
  console.log("--- STARTING SUMMARIZATION TEST ---");

  // Simulate a long conversation (12 messages)
  const longHistory = [
    { role: 'user', content: 'Hi, I am looking for a Frontend Engineer role.' },
    { role: 'assistant', content: 'Great! Let’s start. What is the difference between React state and props?' },
    { role: 'user', content: 'State is internal to a component, props are passed from parent.' },
    { role: 'assistant', content: 'Correct. How does the Virtual DOM work in React?' },
    { role: 'user', content: 'It creates a lightweight copy of the real DOM and batches updates.' },
    { role: 'assistant', content: 'Good. What are React Hooks?' },
    { role: 'user', content: 'They let you use state and other features in functional components.' },
    { role: 'assistant', content: 'Which hook would you use for side effects?' },
    { role: 'user', content: 'useEffect.' },
    { role: 'assistant', content: 'Perfect. What is CSS Specificity?' },
    { role: 'user', content: 'It determines which CSS rule is applied by the browser.' },
    { role: 'assistant', content: 'Explain the Box Model.' }
  ];

  console.log(`Testing with ${longHistory.length} messages. Summarization threshold is 10.`);

  try {
    // We call chatWithAI which now internally calls getManagedContext -> summarizeHistory
    const stream = await chatWithAI('frontend', longHistory);
    
    console.log("\nAI Response (Streaming):");
    for await (const chunk of stream) {
      process.stdout.write(chunk.content || "");
    }
    console.log("\n\n--- TEST COMPLETE ---");
    console.log("Check the console logs above to see if '[AI] Summarizing...' was printed.");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testSummarization();
