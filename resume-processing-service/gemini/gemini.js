const { config } = require("dotenv");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { z } = require("zod");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { CohereEmbeddings } = require("@langchain/cohere");

config();

// Initialize the model
const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
    apiKey: process.env.GOOGLE_API_KEY || 'AIzaSyDmhv2f-BaLUesh249wCIwYIkWCQbKgtFI'
});

// Load the resume PDF and extract text
const getPdfText = async (localFilePath) => {
    const loader = new PDFLoader(localFilePath);
    const docs = await loader.load();
    return docs[0].pageContent;
};

// Define the output schema 
const schema = z.object({
    formatedAnswer: z.string().describe("give the formatted data from the resume text"),
});
const parser = StructuredOutputParser.fromZodSchema(schema);

// Example output for the LLM
const exampleOutput = `{
  -     job_field: main job domain or specialization (e.g., Software Engineering, Data Science, Backend Developer)
        description: a short summary of what the job or experience entails
        experience: years or level of experience mentioned (e.g., intern for three 3 months as a mern stack developer, having 3 years of experience as a mern stack developer,worked experience 1 year as a soft),intern for three 3 months as a mern stack developer 
        education: degrees or certifications (e.g., B.Tech in CS, Master of Data Science)
        skills: list of technical and soft skills (e.g., JavaScript, Python, Communication)
        keywords: relevant domain-specific terms or technologies (e.g., MERN Stack, REST APIs, Leadership)
  }`;

const systemMessage = new SystemMessage(
    `You are an expert resume parser. Extract structured information from resume text.
    Return in String fomat"formatedAnswer" that contains a summary of the candidate's job field, description, experience, education, skills, and keywords.
    Strict rules:
    - Do not infer or fabricate anything — use only what is explicitly stated in the text.
    - Do not provide any explanation, just return the structured data.
    - Output must be clean and consistently formatted.
    - Do not wrap the JSON output in markdown blocks.
    Example output:

    ${exampleOutput}
`
);

const humanMessageTemplate = ChatPromptTemplate.fromTemplate(
    `Resume:
    {resume_text}

    {format_instructions}`
);


const chain = RunnableSequence.from([
    async (input) => [
        systemMessage,
        new HumanMessage(
            await humanMessageTemplate.format({
                resume_text: input.resume_text,
                format_instructions: input.format_instructions,
            })
        ),
    ],
    model,
    parser,
]);

const getStructeredData = async (resumeText) => {

    const response = await chain.invoke({
        resume_text: resumeText,
        format_instructions: parser.getFormatInstructions(),
    });

    console.log("Structured Data:", response.formatedAnswer);
    return response;
};


const getEmbeddings = async (formatedText) => {
    const embeddings = new CohereEmbeddings({
        model: "embed-english-v3.0"
    });

    const result = await embeddings.embedQuery(formatedText);

    return result;
}


module.exports = {
    getPdfText,
    getStructeredData,
    getEmbeddings
}





