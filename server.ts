import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable standard middlewares
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API: Health probe
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Mock Media Upload Route
  // To bypass any missing Firebase Storage configurations in the preview frame,
  // we support saving image/audio uploads to an in-memory or base64 structure and serving it back.
  const uploadedMediaStore = new Map<string, { mimeType: string; buffer: Buffer }>();

  app.post('/api/media/upload', (req, res) => {
    try {
      const { fileData, fileType, fileName } = req.body;
      if (!fileData) {
        res.status(400).json({ error: 'Missing fileData (base64 string required)' });
        return;
      }

      const cleanBase64 = fileData.replace(/^data:image\/\w+;base64,/, '').replace(/^data:audio\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const mediaId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${fileName || 'media'}`;

      uploadedMediaStore.set(mediaId, {
        mimeType: fileType || 'image/jpeg',
        buffer
      });

      const mediaUrl = `/api/media/${mediaId}`;
      res.json({
        success: true,
        mediaId,
        url: mediaUrl
      });
    } catch (error: any) {
      console.error('Upload handler error:', error);
      res.status(500).json({ error: 'Upload processing failed: ' + error.message });
    }
  });

  // Retrieve Uploaded Media
  app.get('/api/media/:mediaId', (req, res) => {
    const { mediaId } = req.params;
    const media = uploadedMediaStore.get(mediaId);

    if (!media) {
      res.status(404).send('Media file not found');
      return;
    }

    res.setHeader('Content-Type', media.mimeType);
    res.send(media.buffer);
  });

  // Helper for Lazy Gemini SDK Initialization
  let aiInstance: GoogleGenAI | null = null;
  function getGeminiAI() {
    if (!aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey !== '') {
        aiInstance = new GoogleGenAI({ apiKey });
      }
    }
    return aiInstance;
  }

  // AI analysis route using Gemini 2.5 Flash
  app.post('/api/ai/analyze', async (req, res) => {
    const { description, imageData, imageType, voiceData, voiceType, existingIssues } = req.body;

    const ai = getGeminiAI();

    // Fallback: If Gemini API Key is missing or invalid, execute smart heuristic matching
    if (!ai) {
      console.warn('[Community Hero] Gemini API Key not found. Falling back to local heuristic analysis.');
      
      const textForAnalysis = `${description || ''} ${voiceType ? 'voice report' : ''}`.toLowerCase();
      let category = 'Other';
      let department = 'City Code Enforcement';
      let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
      let priority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
      let title = 'General Neighborhood Report';

      if (textForAnalysis.includes('pothole') || textForAnalysis.includes('road') || textForAnalysis.includes('pavement') || textForAnalysis.includes('street')) {
        category = 'Potholes & Roads';
        department = 'Public Works Dept';
        title = 'Street Repair Request';
        severity = 'Medium';
        priority = 'Medium';
      } else if (textForAnalysis.includes('trash') || textForAnalysis.includes('garbage') || textForAnalysis.includes('waste') || textForAnalysis.includes('dump')) {
        category = 'Waste & Sanitation';
        department = 'Sanitation Department';
        title = 'Debris Cleanup Required';
        severity = 'Low';
        priority = 'Medium';
      } else if (textForAnalysis.includes('light') || textForAnalysis.includes('lamp') || textForAnalysis.includes('electricity') || textForAnalysis.includes('dark')) {
        category = 'Streetlights & Electricity';
        department = 'Traffic Engineering';
        title = 'Broken Streetlight Fix';
        severity = 'Medium';
        priority = 'Medium';
      } else if (textForAnalysis.includes('leak') || textForAnalysis.includes('water') || textForAnalysis.includes('sewage') || textForAnalysis.includes('pipe')) {
        category = 'Water & Sewage';
        department = 'Water & Sewage Authority';
        title = 'Water Service Damage';
        severity = 'High';
        priority = 'High';
      } else if (textForAnalysis.includes('tree') || textForAnalysis.includes('park') || textForAnalysis.includes('playground') || textForAnalysis.includes('bench')) {
        category = 'Public Parks';
        department = 'Parks & Recreation';
        title = 'Park Maintenance Task';
        severity = 'Low';
        priority = 'Low';
      } else if (textForAnalysis.includes('graffiti') || textForAnalysis.includes('vandal') || textForAnalysis.includes('spray')) {
        category = 'Vandalism & Graffiti';
        department = 'City Code Enforcement';
        title = 'Graffiti Abatement';
        severity = 'Low';
        priority = 'Low';
      }

      if (textForAnalysis.includes('urgent') || textForAnalysis.includes('danger') || textForAnalysis.includes('accident') || textForAnalysis.includes('critical') || textForAnalysis.includes('hazard')) {
        severity = 'Critical';
        priority = 'Critical';
      }

      // Check duplicate fallback (if any match title/category closely)
      let isDuplicate = false;
      let duplicateIssueId = '';
      let duplicateExplanation = '';

      if (existingIssues && Array.isArray(existingIssues)) {
        const match = existingIssues.find((issue: any) => 
          issue.category === category && 
          (issue.title.toLowerCase().includes(title.toLowerCase()) || 
           issue.description.toLowerCase().includes(description?.toLowerCase() || 'xyz'))
        );
        if (match) {
          isDuplicate = true;
          duplicateIssueId = match.id;
          duplicateExplanation = `This report matches another ongoing issue "${match.title}" reported nearby.`;
        }
      }

      res.json({
        title,
        description: description || 'No voice note transcription or text provided. Local heuristics analyzed general markers.',
        category,
        department,
        severity,
        priority,
        isDuplicate,
        duplicateIssueId,
        duplicateExplanation,
        fallbackMode: true
      });
      return;
    }

    try {
      // Formulate detailed Gemini Prompt
      const promptText = `
        You are the primary AI intelligence engine for "Community Hero", a municipal civic accountability platform.
        Analyze this citizen report to categorize, route, assess safety severity, and detect potential duplicate reports.

        User Text Description: "${description || 'None provided'}"

        Existing Issues in the Area (for duplicate complaint analysis):
        ${JSON.stringify(existingIssues || [])}

        Your Analysis Directives:
        1. Title: Create an concise, highly descriptive, action-oriented title (e.g., "Deep Pothole Near Highway 101", "Illegal Dumping behind Central Park"). Max 6 words.
        2. Description: Summarize the issue. If there is a voice note or an image, transcribe/incorporate their contents into a complete, professional, yet simple problem description.
        3. Category: Select exactly one of: "Potholes & Roads", "Waste & Sanitation", "Streetlights & Electricity", "Water & Sewage", "Public Parks", "Vandalism & Graffiti", "Other".
        4. Department Routing: Assign to the correct municipal responder. Select exactly one of: "Public Works Dept", "Sanitation Department", "Traffic Engineering", "Water & Sewage Authority", "Parks & Recreation", "City Code Enforcement".
        5. Severity & Priority: Choose ("Low", "Medium", "High", "Critical"). Base this on immediate structural or public physical safety risks.
        6. Duplicate Detection: Check if the described problem is identical to or overlapping with any of the provided nearby "Existing Issues". If it's a clear duplicate, mark isDuplicate = true and supply duplicateIssueId and a brief duplicateExplanation. Otherwise, set isDuplicate = false.

        Provide your response strictly in valid JSON matching the schema.
      `;

      const contents: any[] = [];
      const parts: any[] = [{ text: promptText }];

      // Handle multi-modal image buffer
      if (imageData) {
        const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: imageType || 'image/jpeg'
          }
        });
      }

      // Handle multi-modal voice/audio note buffer
      if (voiceData) {
        const cleanBase64 = voiceData.replace(/^data:audio\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: voiceType || 'audio/webm'
          }
        });
      }

      contents.push({ role: 'user', parts });

      // Model Call with Strict JSON schema constraint
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              department: { type: 'string' },
              severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
              isDuplicate: { type: 'boolean' },
              duplicateIssueId: { type: 'string' },
              duplicateExplanation: { type: 'string' }
            },
            required: ['title', 'description', 'category', 'department', 'severity', 'priority', 'isDuplicate']
          }
        }
      });

      const jsonText = response.text || '{}';
      const parsedAnalysis = JSON.parse(jsonText);
      res.json(parsedAnalysis);

    } catch (err: any) {
      console.error('[Community Hero] Gemini API Error:', err);
      res.status(500).json({ error: 'AI analysis failed: ' + err.message });
    }
  });

  // Vite Middleware integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Community Hero] Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Community Hero] Failed to start server:', err);
});
