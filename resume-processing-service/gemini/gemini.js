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
    apiKey: process.env.GOOGLE_API_KEY
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

    console.log("Structured Data:");
    return response;
};


const getEmbeddings = async (formatedText) => {
    const embeddings = new CohereEmbeddings({
        model: "embed-english-v3.0"
    });

    const result = await embeddings.embedQuery(formatedText);

    return result;
}


//get email html template
const getEmailHtmlTemplate = async (update) => {
    const schema = z.object({
        formatedAnswer: z.string().describe("give the styled html content according to the given details Generate an HTML email notification with the same style that notifies the applicant of their scheduled interview."),
    });
    const parser = StructuredOutputParser.fromZodSchema(schema);

    const exampleOutput = `
            Here is an example of the type of HTML email I want when an interview is scheduled:
            <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <title>Interview Scheduled Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <tr>
            <td style="padding: 20px;">
                <h2 style="color: #333333;">📅 Interview Scheduled</h2>
                <p style="font-size: 16px; color: #555;">
                Hello <strong>{{applicantName}}</strong>,
                </p>
                <p style="font-size: 16px; color: #555;">
                Great news! You have been scheduled for an interview for the position of <strong>{{jobTitle}}</strong> at <strong>{{company}}</strong>.
                </p>

                <table cellpadding="0" cellspacing="0" style="margin-top: 20px; background-color: #f9f9f9; border-radius: 6px; padding: 15px; width: 100%;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Date:</strong> {{scheduledDate}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Time:</strong> {{scheduledTime}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Location:</strong> {{jobLocation}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Recruiter:</strong> {{recruiterName}} ({{recruiterEmail}})</td>
                </tr>
                </table>

                <p style="font-size: 16px; color: #555; margin-top: 20px;">
                Please prepare accordingly and feel free to reach out to the recruiter if you have any questions.
                </p>

                <p style="margin-top: 30px; font-size: 14px; color: #999;">
                Thank you,<br>
                <strong>Your Hiring Platform</strong>
                </p>
            </td>
            </tr>
        </table>
        </body>
        </html>

        
    `

    const systemMessage = new SystemMessage(
        `
        You are an expert assistant that creates professional and user-friendly HTML email templates.
        Your task is to generate clean, mobile-friendly HTML emails that notify job applicants about updates such as interview schedules.
        Use clear and polite language, include all relevant details (e.g. job title, company name, date/time of interview), and structure the email in a readable and visually appealing format.
        The design should be simple and responsive, with inline CSS for maximum email client compatibility. Avoid JavaScript or external CSS files.
        Always use semantic HTML and a consistent style.
        example output:
        ${exampleOutput}
        
        `);

    const humanMessageTemplate = ChatPromptTemplate.fromTemplate(
        `update:
        {data}

        {format_instructions}`
    );

    const chain = RunnableSequence.from([
        async (input) => [
            systemMessage,
            new HumanMessage(
                await humanMessageTemplate.format({
                    data: input.data,
                    format_instructions: input.format_instructions,
                })
            ),
        ],
        model,
        parser,
    ]);


    const response = await chain.invoke({
        data: update,
        format_instructions: parser.getFormatInstructions(),
    });

    console.log("html created:",response.formatedAnswer);
    return response.formatedAnswer;
}
module.exports = {
    getPdfText,
    getStructeredData,
    getEmbeddings,
    getEmailHtmlTemplate
}





