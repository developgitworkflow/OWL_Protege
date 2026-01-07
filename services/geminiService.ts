import { GoogleGenAI, Type } from "@google/genai";
import { UMLNode, UMLNodeData, ElementType, Attribute, Method } from "../types";
import { Node, Edge } from 'reactflow';

// Ensure API key is available
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-3-flash-preview';

export const generateDiagramFromPrompt = async (prompt: string): Promise<{ nodes: Node[], edges: Edge[] } | null> => {
  if (!apiKey) {
    console.error("API Key is missing");
    return null;
  }

  const systemInstruction = `
    You are an expert software architect and ontologist specialized in UML and OWL2.
    Your task is to generate a JSON structure representing a diagram based on the user's description.
    
    The output must strictly adhere to the following schema compatible with ReactFlow:
    {
      "nodes": [
        {
          "id": "string",
          "type": "umlNode",
          "position": { "x": number, "y": number },
          "data": {
            "label": "string",
            "type": "class" | "interface" | "owl_class",
            "attributes": [{ "id": "string", "name": "string", "type": "string", "visibility": "+" | "-" }],
            "methods": [{ "id": "string", "name": "string", "returnType": "string", "visibility": "+" | "-" }]
          }
        }
      ],
      "edges": [
        { "id": "string", "source": "string", "target": "string", "label": "string", "type": "smoothstep" }
      ]
    }
    
    Lay out the nodes reasonably (e.g. x, y coordinates) so they don't overlap too much.
    Spread them out. Start x at 100, y at 100.
    For UML, use standard conventions. For OWL, use 'owl_class' as type.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  position: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER }
                    }
                  },
                  data: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      type: { type: Type.STRING },
                      attributes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            type: { type: Type.STRING },
                            visibility: { type: Type.STRING }
                          }
                        }
                      },
                      methods: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            returnType: { type: Type.STRING },
                            visibility: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);

  } catch (error) {
    console.error("Error generating diagram:", error);
    return null;
  }
};

export const explainDiagram = async (nodes: Node[], edges: Edge[]): Promise<string> => {
    if (!apiKey) return "API Key missing.";

    const context = JSON.stringify({ nodes: nodes.map(n => n.data), edges });
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Analyze this UML/OWL model structure and provide a summary of the system architecture, potential design patterns used, and suggestions for improvement.\n\nData: ${context}`
        });
        return response.text || "Could not generate explanation.";
    } catch (e) {
        console.error(e);
        return "Error analyzing diagram.";
    }
}
