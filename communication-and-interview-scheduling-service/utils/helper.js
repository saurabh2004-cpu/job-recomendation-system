

//create a email HTML teplate
const createEmailHtmlTemplate = (jobs) => {
    console.log("jobs in helper", jobs);
    let htmlString = `
        <!DOCTYPE html>
        <html>
        <head>
        <style>
            body {
            font-family: Arial, sans-serif;
            background-color: #f3f2ef;
            padding: 20px;
            color: #333;
            }
            .job-container {
            max-width: 600px;
            margin: 0 auto;
            }
            .job-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 20px;
            border-left: 4px solid #0a66c2;
            }
            .job-card h3 {
            margin-top: 0;
            color: #0a66c2;
            }
            .job-meta {
            font-size: 14px;
            color: #555;
            margin: 5px 0 10px;
            }
            .job-description {
            font-size: 14px;
            margin-bottom: 10px;
            }
            .job-skills {
            font-size: 13px;
            color: #666;
            margin-bottom: 10px;
            }
            .view-button {
            display: inline-block;
            background-color: #0a66c2;
            color: #fff;
            text-decoration: none;
            padding: 10px 16px;
            border-radius: 5px;
            font-weight: bold;
            font-size: 14px;
            }
        </style>
        </head>
        <body>
        <div class="job-container">
            <h2>🔍 We've found some job matches for you</h2>
            ${jobs.map(job => {
        const {
            jobField,
            company,
            location,
            description,
            salary,
            jobType,
            experience,
            education,
            requiredSkills,
            _id
        } = job.jobData || {};
        const matchPercentage = job.matchPercentage !== undefined ? job.matchPercentage.toFixed(2) : '';
        return `
                    <div class="job-card">
                        <h3>${jobField || ''} at ${company || ''}</h3>
                        <div class="job-meta">
                            📍 ${location || ''} | 💼 ${jobType || ''} | 💰 ${salary || ''}
                        </div>
                        <div class="job-description">
                            ${(description || '').slice(0, 150)}...
                        </div>
                        <div class="job-skills">
                            <strong>Skills:</strong> ${requiredSkills || ''}
                        </div>
                        <div class="job-skills">
                            <strong>Experience:</strong> ${experience || ''} | <strong>Education:</strong> ${education || ''}
                        </div>
                        <div class="job-skills">
                            <strong>Match:</strong> ${matchPercentage}%
                        </div>
                        <a class="view-button" href="https://yourdomain.com/jobs/${_id || ''}" target="_blank">View Job</a>
                    </div>
                `;
    }).join('')}
        </div>
        </body>
        </html>
    `;
    return htmlString;
}


module.exports = { createEmailHtmlTemplate }





