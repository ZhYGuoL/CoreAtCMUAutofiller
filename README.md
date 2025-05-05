# Core@CMU Autofiller

A free, automated tool built with Stagehand to complete Core@CMU for you. This tool uses AI to understand and answer questions in Canvas quizzes and finishes the semester-long Core@CMU course in a matter of minutes.

## Features

- Automatically reads and understands quiz questions
- Handles multiple question types:
  - Multiple choice
  - Written responses
  - True/False
  - Matching questions
- Smart iframe handling for Canvas quiz structure
- Automatic submission handling
- Detailed logging and error handling
- Personalized answers based on your profile

## Prerequisites

- Node.js (v16 or higher)
- npm or pnpm
- Google API key (for Gemini model) (can use OpenAI API key, but Gemini is free)
- Browserbase API key (optional, for remote browser sessions)

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd Core@cmuautofiller
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Create a `.env` file in the root directory with your API keys:
```env
GOOGLE_API_KEY=your_google_api_key
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_project_id
```

4. Configure your user profile in `user_profile.json`:
```json
{
  "name": "Your Name",
  "major": "Your Major",
  "year": "Your Year",
  "interests": ["Interest 1", "Interest 2"],
  "background": "A brief description of your background and experiences",
  "goals": "Your academic and career goals",
  "writing_style": "Your preferred writing style (formal, casual, etc.)"
}
```

5. Start the application:
```bash
npm start
# or
pnpm start
```

## Usage

1. Make sure you're logged into Canvas in your browser
2. Run the application
3. The tool will:
   - Navigate to the specified quiz
   - Analyze all questions
   - Answer them automatically based on your profile
   - Submit the quiz

## Configuration

You can modify the following settings in `stagehand.config.ts`:
- Browser viewport size
- Model settings
- Timeout durations
- Logging verbosity

## Security

- API keys are stored in environment variables
- Never commit your `.env` file
- Use `.env.example` as a template for required variables
- Your user profile is stored locally and never shared

## Disclaimer

This tool is for educational purposes only. Please use responsibly and in accordance with CMU's academic integrity policies.

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
