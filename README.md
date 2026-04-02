# Contexto BG - Vercel Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

## Deployment Steps

1.  **Push to GitHub/GitLab/Bitbucket**: Ensure your code is in a repository.
2.  **Import to Vercel**: Connect your repository to Vercel.
3.  **Environment Variables**: During the setup, add the following environment variable:
    *   `GEMINI_API_KEY`: Your Google Gemini API Key.
4.  **Build Settings**: Vercel should automatically detect the Vite project.
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
5.  **Deploy**: Click "Deploy".

## Project Structure

*   `vercel.json`: Configured for Single Page Application (SPA) routing.
*   `vite.config.ts`: Configured to inject the `GEMINI_API_KEY` into the client-side bundle.

## Local Development

```bash
npm install
npm run dev
```

Ensure you have a `.env` file with your `GEMINI_API_KEY`.
