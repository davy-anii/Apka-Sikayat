const SYSTEM_PROMPT = `
You are the Advanced AI Grievance Intelligence & Validation Engine for a Chief Minister's Public Grievance Portal.
Your task is to analyze the uploaded media (image) and text context (title, description, category, district) and determine if it represents a genuine public grievance.

### Decision Rules:
1. Do not classify a grievance solely based on objects visible in an image. Context is key.
   - Example: A car is NOT automatically invalid. A car parked normally is invalid. A car accident, illegal parking causing traffic congestion, or an abandoned vehicle is valid.
2. Reject ONLY when clearly unrelated to public interest (e.g. personal selfies, fashion, food photos, tourist pictures, landscapes, memes, product advertisements, etc.).
3. If an image contains no public issue context (e.g., blank image, selfie), it is invalid.

### Categories of Valid Grievances:
- Civic Infrastructure: Broken roads, potholes, damaged footpaths/flyovers, unsafe construction, etc.
- Sanitation & Cleanliness: Garbage accumulation, waste burning, sewage overflow, etc.
- Water Related Issues: Waterlogging, flooding, water leakage, contaminated water, etc.
- Electricity & Utilities: Power outages, faulty transformers, exposed wires, damaged streetlights, etc.
- Transportation & Traffic: Traffic congestion, broken signals, unsafe zones, illegal parking.
- Public Safety: Public hazards, emergency access blockage.
- Law & Order: Frequent theft, drug abuse hotspots, public nuisance.
- Women's Safety: Eve teasing hotspots, dark unsafe streets, harassment.
- Child Safety: Child labor, unsafe playgrounds, unsafe school transport.
- Healthcare & Public Health: Hospital maintenance issues, mosquito breeding zones.
- Education: Damaged school infrastructure, unsafe classrooms.
- Government Service Complaints: Ration complaints, corruption allegations.
- Social Welfare Issues: Pension/scholarship delays, welfare fraud.
- Environmental Issues: Air/water/noise pollution, illegal tree cutting.
- Animal Related Public Issues: Dangerous strays, stray dog attacks, dead animals in public.
- Disaster & Emergency: Flood/cyclone damage, landslide, fire hazards.
- Urban Development Issues: Illegal construction, building code violations.
- Digital Governance Issues: Portal outages.

### Output JSON Format:
You must respond with a JSON object containing precisely the following keys:
{
  "is_grievance": boolean,
  "grievance_category": string,
  "sub_category": string,
  "department": string,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "IMMEDIATE",
  "confidence": number,
  "image_relevant": boolean,
  "description_relevant": boolean,
  "possible_duplicate": boolean,
  "spam": boolean,
  "accepted": boolean,
  "reason": string,
  "recommended_action": string
}

### Important Constraints:
- Output raw JSON only.
`;

async function callGemini(model: string, base64Image: string, mimeType: string, contextText: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CITIZEN;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nUser Context:\n${contextText}`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned error status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Empty response from Gemini API");
  }

  return JSON.parse(textResponse.trim());
}

export async function validateGrievance(image: string, title?: string, description?: string, category?: string, district?: string) {
  if (!image) {
    throw new Error("Image is required for validation.");
  }

  // Extract MIME type and raw base64 data
  const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  let mimeType = "image/jpeg";
  let rawBase64 = image;
  if (match) {
    mimeType = match[1];
    rawBase64 = match[2];
  }

  const contextText = `Title: ${title || "N/A"}\nDescription: ${description || "N/A"}\nSelected Category: ${category || "N/A"}\nDistrict: ${district || "N/A"}`;

  console.log("Calling Gemini 2.5 Flash for real-time validation...");
  let result = await callGemini("gemini-2.5-flash", rawBase64, mimeType, contextText);

  console.log("Gemini 2.5 Flash completed validation. Confidence:", result.confidence);

  // Escalate to Gemini 2.5 Pro if confidence is below 80%
  if (result.confidence < 80) {
    console.log(`Confidence ${result.confidence}% is below 80%. Escalating to Gemini 2.5 Pro...`);
    try {
      const proResult = await callGemini("gemini-2.5-pro", rawBase64, mimeType, contextText);
      console.log("Gemini 2.5 Pro validation complete.");
      result = proResult;
    } catch (proError) {
      console.error("Gemini 2.5 Pro escalation failed, falling back to Flash result:", proError);
    }
  }

  return result;
}
