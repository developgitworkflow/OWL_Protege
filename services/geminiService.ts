
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
    You are an expert ontologist specialized in W3C OWL 2 (Web Ontology Language).
    Your task is to generate a JSON structure representing an ontology diagram based on the user's description.

    MAPPING RULES (OWL 2 Syntax):
    1. **Classes**: Use type 'owl_class'.
    2. **Individuals**: Use type 'owl_named_individual'.
    3. **Datatypes**: Use type 'owl_datatype'.
    4. **Data Properties**: Map these to the 'attributes' array of a node. 
       - 'name' = Property IRI or Label (e.g., 'hasAge').
       - 'type' = XSD Type (e.g., 'xsd:integer').
    5. **Object Properties**: Map these to 'edges' connecting nodes. 
       - 'label' = Property IRI (e.g., 'isLocatedIn', 'hasPart').
    6. **Axioms/Restrictions**: Map these to the 'methods' array of a node for visualization.
       - 'name' = Restriction type (e.g., 'DisjointWith', 'EquivalentTo').
       - 'returnType' = The value (e.g., 'Vegetable', 'min 1 hasPart').

    The output must strictly adhere to the following schema compatible with ReactFlow:
    {
      "nodes": [
        {
          "id": "string",
          "type": "umlNode",
          "position": { "x": number, "y": number },
          "data": {
            "label": "string",
            "type": "owl_class" | "owl_named_individual" | "owl_datatype",
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
            contents: `Analyze this OWL 2 ontology structure. 
            Discuss Classes, Object Properties, Data Properties, and Individuals.
            Provide a summary of the semantics and logic.\n\nData: ${context}`
        });
        return response.text || "Could not generate explanation.";
    } catch (e) {
        console.error(e);
        return "Error analyzing diagram.";
    }
}

export const generateSWRLRule = async (description: string, ontologyContext: string): Promise<string | null> => {
  if (!apiKey) return null;

  const systemInstruction = `
    You are an expert in Semantic Web Rule Language (SWRL).
    Convert the user's natural language description into a valid SWRL rule.
    
    Ontology Context (Vocabulary you should try to use):
    ${ontologyContext}

    Syntax Rules:
    1. Atoms: Class(?x), Property(?x, ?y), BuiltIn(?x, val).
    2. Variables: Start with '?'.
    3. Conjunction: ' ^ '.
    4. Implication: ' -> '.
    5. Strings: enclosed in double quotes.
    6. Integers: standard numbers.
    7. Built-ins: Use 'swrlb:' prefix (e.g., swrlb:greaterThan, swrlb:equal).
    
    Example Input: "If a person has an age greater than 18, they are an Adult"
    Example Output: Person(?p) ^ hasAge(?p, ?age) ^ swrlb:greaterThan(?age, 18) -> Adult(?p)
    
    Return ONLY the rule string. No markdown, no explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: description,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Low temp for syntax precision
      }
    });
    return response.text?.trim() || null;
  } catch (error) {
    console.error("Error generating SWRL:", error);
    return null;
  }
};

export const suggestSWRLRules = async (ontologyContext: string): Promise<{ label: string, rule: string, desc: string }[]> => {
  if (!apiKey) return [];

  const systemInstruction = `
    You are an expert in Semantic Web Rule Language (SWRL) and Ontology Engineering.
    Analyze the provided Ontology Context (Classes and Properties).
    Suggest 3 plausible and logically sound SWRL rules that fit this specific domain.
    
    Focus on:
    1. Property composition (e.g., parent's brother -> uncle).
    2. Classification based on data values (e.g., high price -> LuxuryItem).
    3. Interaction between object properties (e.g., location containment).
    4. Transitive or Symmetric implications not easily expressed in pure OWL.

    Ontology Context:
    ${ontologyContext}

    Return a JSON array where each object has:
    - label: Short 2-3 word name for the rule.
    - rule: The SWRL expression.
    - desc: A concise explanation (max 1 sentence).
    
    Do not suggest rules that are purely tautological (A -> A).
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Suggest relevant rules based on the context.",
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING },
                    rule: { type: Type.STRING },
                    desc: { type: Type.STRING }
                }
            }
        }
      }
    });
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error suggesting SWRL:", error);
    return [];
  }
};

export const generateDLQuery = async (description: string, ontologyContext: string): Promise<string | null> => {
  if (!apiKey) return null;

  const systemInstruction = `
    You are an expert in OWL 2 Manchester Syntax Description Logic queries.
    Convert the user's natural language question into a valid DL query expression based on the provided ontology.

    Ontology Context (Manchester Syntax):
    ${ontologyContext}

    Syntax Rules (Manchester Syntax):
    1. Intersection: 'and'
    2. Union: 'or'
    3. Negation: 'not'
    4. Existential: 'property some Class'
    5. Universal: 'property only Class'
    6. Cardinality: 'property min n Class', 'property max n Class', 'property exactly n Class'
    7. Has Value: 'property value Individual' or 'property value "literal"'
    8. Inverse: 'inverse property'

    Guidelines:
    - Use the exact Class, Property, and Individual names defined in the Context.
    - Infer relationships based on Domain, Range, and SubClassOf axioms found in the context.
    - If asking for "Courses taught by X", and you only have "teaches", use "inverse teaches" or appropriate restrictions.
    - Keep it concise.

    Example Input: "People who teach at least one course"
    Example Output: Person and teaches some Course

    Return ONLY the query string. No markdown, no explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: description,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      }
    });
    return response.text?.trim() || null;
  } catch (error) {
    console.error("Error generating DL Query:", error);
    return null;
  }
};
