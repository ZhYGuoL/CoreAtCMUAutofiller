import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */

interface Question {
  type: 'multiple_choice' | 'written' | 'matching' | 'true_false';
  text: string;
  options?: string[];
  answer?: string;
}

async function analyzeQuizPage(page: Page, stagehand: Stagehand) {
  // Wait for any iframes to load
  await page.waitForTimeout(5000);

  try {
    // First try to find and switch to the quiz iframe
    const frames = page.frames();
    const quizFrame = frames.find(frame => 
      frame.url().includes('quiz') || 
      frame.url().includes('assessment') ||
      frame.url().includes('canvas')
    );

    if (quizFrame) {
      stagehand.log({
        category: "quiz-autofiller",
        message: "Found quiz iframe, switching context...",
      });
      
      // Wait for the frame to be ready
      await quizFrame.waitForLoadState('networkidle');
      
      const { questions } = await quizFrame.evaluate(() => {
        const questionElements = document.querySelectorAll('.question, .quiz_question');
        return {
          questions: Array.from(questionElements).map(q => {
            const type = q.classList.contains('multiple_choice') ? 'multiple_choice' as const :
                        q.classList.contains('true_false') ? 'true_false' as const :
                        q.classList.contains('matching') ? 'matching' as const :
                        'written' as const;
            
            return {
              type,
              text: q.querySelector('.question_text, .question-text')?.textContent?.trim() || '',
              options: Array.from(q.querySelectorAll('.answer, .answer_option, input[type="radio"]'))
                .map(o => o.textContent?.trim() || '')
                .filter(o => o.length > 0)
            };
          })
        };
      });
      
      return questions;
    }

    // Fallback to main page if no iframe found
    stagehand.log({
      category: "quiz-autofiller",
      message: "No quiz iframe found, trying main page...",
    });

    const { questions } = await page.evaluate(() => {
      const questionElements = document.querySelectorAll('.question, .quiz_question');
      return {
        questions: Array.from(questionElements).map(q => {
          const type = q.classList.contains('multiple_choice') ? 'multiple_choice' as const :
                      q.classList.contains('true_false') ? 'true_false' as const :
                      q.classList.contains('matching') ? 'matching' as const :
                      'written' as const;
          
          return {
            type,
            text: q.querySelector('.question_text, .question-text')?.textContent?.trim() || '',
            options: Array.from(q.querySelectorAll('.answer, .answer_option, input[type="radio"]'))
              .map(o => o.textContent?.trim() || '')
              .filter(o => o.length > 0)
          };
        })
      };
    });

    return questions;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stagehand.log({
      category: "quiz-autofiller",
      message: "Error analyzing quiz page",
      auxiliary: {
        error: {
          value: errorMessage,
          type: "string",
        },
      },
    });
    throw error; // Re-throw to handle in main function
  }
}

async function answerQuestion(page: Page, question: Question, stagehand: Stagehand) {
  try {
    // Find the quiz frame
    const frames = page.frames();
    const quizFrame = frames.find(frame => 
      frame.url().includes('quiz') || 
      frame.url().includes('assessment') ||
      frame.url().includes('canvas')
    );

    const targetPage = quizFrame || page;

    // Wait for the question to be visible
    await targetPage.waitForSelector('.question, .quiz_question', { timeout: 5000 });

    switch (question.type) {
      case 'multiple_choice':
        await targetPage.click(`text=${question.text} >> xpath=../..//input[contains(@class, 'answer')]`);
        break;
      case 'written':
        await targetPage.fill(`text=${question.text} >> xpath=../..//textarea`, 'Comprehensive answer based on the question context');
        break;
      case 'true_false':
        await targetPage.click(`text=${question.text} >> xpath=../..//input[@type="radio"]`);
        break;
      case 'matching':
        // Handle matching questions by clicking and dragging
        const matches = await targetPage.$$(`text=${question.text} >> xpath=../..//.matching-item`);
        for (const match of matches) {
          await match.click();
          await targetPage.waitForTimeout(500);
        }
        break;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stagehand.log({
      category: "quiz-autofiller",
      message: `Error answering question: ${question.text}`,
      auxiliary: {
        error: {
          value: errorMessage,
          type: "string",
        },
      },
    });
    // Wait a bit longer and retry once
    await page.waitForTimeout(2000);
    try {
      await page.act(`Try again to answer the question: "${question.text}"`);
    } catch (retryError) {
      stagehand.log({
        category: "quiz-autofiller",
        message: `Failed to retry question: ${question.text}`,
        auxiliary: {
          error: {
            value: retryError instanceof Error ? retryError.message : 'Unknown error',
            type: "string",
          },
        },
      });
    }
  }
}

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  // Navigate to the Canvas quiz
  await page.goto("https://canvas.cmu.edu/courses/44865/pages/step-3-make-a-plan-how-to-study?module_item_id=6003850");
  
  // Wait for page load and user verification
  stagehand.log({
    category: "quiz-autofiller",
    message: "Waiting for page load and user verification...",
  });
  await page.waitForTimeout(10000); // Wait 10 seconds

  stagehand.log({
    category: "quiz-autofiller",
    message: "Page loaded, proceeding with quiz analysis...",
  });

  await page.waitForTimeout(10000); 

  // Analyze the quiz page
  const questions = await analyzeQuizPage(page, stagehand);
  
  // Process each question
  for (const question of questions) {
    stagehand.log({
      category: "quiz-autofiller",
      message: `Processing question: ${question.text}`,
      auxiliary: {
        questionType: {
          value: question.type,
          type: "string",
        },
      },
    });

    await answerQuestion(page, question, stagehand);
    await page.waitForTimeout(1000); // Wait between questions
  }

  // Submit the quiz
  await page.act("Submit the quiz");
  
  // Handle any confirmation dialogs
  await page.act("Confirm submission if prompted");

  stagehand.log({
    category: "quiz-autofiller",
    message: "Quiz completed",
    auxiliary: {
      metrics: {
        value: JSON.stringify(stagehand.metrics),
        type: "object",
      },
    },
  });
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

run();
