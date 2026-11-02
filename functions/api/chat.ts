interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ScreenContext {
  activeCategory: string;
  selectedAlbumName?: string;
  currentSongName?: string;
  currentEraName?: string;
}

interface RequestBody {
  message: string;
  history: ChatMessage[];
  screenContext: ScreenContext;
  trackerSummary: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, history = [], screenContext, trackerSummary } = body;

  const screenDesc = buildScreenDescription(screenContext);

  const systemPrompt = `You are a knowledgeable assistant for UNVAULTED, a comprehensive fan tracker for Ye (formerly Kanye West) unreleased and leaked music. You help users find information about songs, eras, leaks, quality ratings, and availability.

The site organizes unreleased/leaked Ye music by "eras" (albums/time periods). Songs have metadata like quality (CDQ = CD quality, HQ = high quality, LQ = low quality), available length (Full, Partial, Snippet), leak dates, BPM, and file dates. Songs without a URL are unavailable/not yet leaked. Some song lines include "notes:" — the tracker's description of that song (history, origin, versions, who's on it, how it leaked); eras may have an "era notes:" line describing the era. Notes are only included for songs relevant to the current conversation, so a song without notes may still have a description on the tracker.

Currently the user is viewing: ${screenDesc}

Here is the complete tracker data:
${trackerSummary}

Guidelines:
- Be thorough and detailed — give full, complete answers and don't cut responses short
- When referencing songs or eras, link to them using markdown: [Era Name](/album/slug) — the url is provided next to each era in the tracker data as "url:/album/..."
- When mentioning an era, always hyperlink its name so the user can click to navigate there
- When referencing songs, mention quality and availability if relevant
- If asked about a specific song, check all eras since the same song can appear in multiple eras
- When mentioning song names, always omit any bracketed or parenthetical tags (e.g. [CDQ], [HQ], [LQ], [Interlude], (Intro), (V2)) — use only the clean song name
- Don't make up information — if something isn't in the tracker data, say so
- You can also answer general questions about Ye's music history and discography`;

  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 65536, temperature: 0.7 },
        }),
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to reach Gemini API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return new Response(JSON.stringify({ error: 'Gemini API error', details: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const json = (await geminiRes.json()) as any;
  const reply = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return new Response(JSON.stringify({ reply }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

function buildScreenDescription(ctx: ScreenContext): string {
  const parts: string[] = [`the "${ctx.activeCategory}" section`];
  if (ctx.selectedAlbumName) parts.push(`viewing album "${ctx.selectedAlbumName}"`);
  if (ctx.currentSongName) parts.push(`"${ctx.currentSongName}" currently playing`);
  if (ctx.currentEraName && ctx.currentEraName !== ctx.selectedAlbumName) {
    parts.push(`from the "${ctx.currentEraName}" era`);
  }
  return parts.join(', ');
}
