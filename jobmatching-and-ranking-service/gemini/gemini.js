const { config } = require("dotenv");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
// const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { z } = require("zod");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { CohereEmbeddings } = require("@langchain/cohere");
const { json } = require("body-parser");

config();

// Initialize the model
const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
    apiKey: process.env.GOOGLE_API_KEY || 'AIzaSyDmhv2f-BaLUesh249wCIwYIkWCQbKgtFI'
});

// Load the resume PDF and extract text
// const getPdfText = async (localFilePath) => {
//     const loader = new PDFLoader(localFilePath);
//     const docs = await loader.load();
//     return docs[0].pageContent;
// };

// Define the output schema 
const schema = z.object({
    formatedAnswer: z.string().describe("give the formatted data from the resume text"),
});
const parser = StructuredOutputParser.fromZodSchema(schema);

// Example output for the LLM
const exampleOutput = `job_field: Software Engineering
    description: Full Stack Developer with expertise in React, Node.js, and Express.
    experience: 3 years
    education: B.Tech in Computer Science
    skills: JavaScript, Python, Communication
    keywords: MERN Stack, REST APIs, Leadership`
;

const systemMessage = new SystemMessage(
    `You are a professional parser for job-related data. Your job is to extract clean, structured information from the following unstructured text, which can be job description
    Return in String format that contains a summary of the job description.

        ### Step 1: Fix the formatting
        - Insert missing spaces and punctuation.
        - Ensure clear, readable formatting.
        - Keep the original meaning exactly the same.
        - Do **not** add or invent any information.

        ### Step 2: Extract only the following structured fields:

        - job_field: main job domain or specialization (e.g., Software Engineering, Data Science, Backend Developer)
        - description: a short summary of what the job or experience entails
        - experience: years or level of experience mentioned (e.g., 3 years, Fresher, Senior-level)
        - education: degrees or certifications (e.g., B.Tech in CS, Master of Data Science)
        - skills: list of technical and soft skills (e.g., JavaScript, Python, Communication)
        - keywords: relevant domain-specific terms or technologies (e.g., MERN Stack, REST APIs, Leadership)

        ### Strict Rules:
        - Do not infer or fabricate anything — use only what is **explicitly stated** in the text
        - Do not provide any explanation, just return the structured data
        - Output must be clean and consistently formatted

        Example output:

        ${exampleOutput}
`
);

const humanMessageTemplate = ChatPromptTemplate.fromTemplate(
    `Job details:
    {job_details}

    {format_instructions}`
);


const chain = RunnableSequence.from([
    async (input) => [
        systemMessage,
        new HumanMessage(
            await humanMessageTemplate.format({
                job_details: input.job_details,
                format_instructions: input.format_instructions,
            })
        ),
    ],
    model,
    parser,
]);

const getStructeredData = async (jobBody) => {

    const { jobField, description, experience, education, requiredSkills } = jobBody;

    // Build a readable string for the LLM, not JSON
    const jobDetailsString =
        (jobField ? `Job Field: ${jobField}\n` : "") +
        (description ? `Description: ${description}\n` : "") +
        (experience ? `Experience: ${experience}\n` : "") +
        (education ? `Education: ${education}\n` : "") +
        (requiredSkills ? `Required Skills: ${requiredSkills}` : "");

    if (!jobDetailsString.trim()) {
        throw new Error('All fields are empty');
    }

    const response = await chain.invoke({
        job_details: jobDetailsString,
        format_instructions: parser.getFormatInstructions(),
    });

    console.log("Structured Data:", response.formatedAnswer);
    return response;
};


const getEmbeddings = async (formatedText) => {
    const embeddings = new CohereEmbeddings({
        model: "embed-english-v3.0",
        apiKey: process.env.COHERE_API_KEY
    });

    const result = await embeddings.embedQuery(formatedText);

    return result;
}


module.exports = {
    // getPdfText,
    getStructeredData,
    getEmbeddings
}





