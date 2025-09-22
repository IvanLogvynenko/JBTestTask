import { Octokit } from "@octokit/rest";

function printDebug(msg, config) {
  if (config.debug) {
    console.log("[DEBUG]", msg);
  }
}

let config = {
  githubToken: "",
  githubRepo: "",

  youtrackToken: "",
  youtrackServername: "",
  youtrackProjectId: "",
  youtrackProjectName: "",

  debug: false,
  // debug: true,
};

//If entry is not provided, load it from env vars
if (config.githubToken == "") {
	config.githubToken = process.env.GITHUB_TOKEN;
}
if (config.githubRepo == "") {
  config.githubRepo = process.env.GITHUB_REPO;
}
if (config.youtrackToken == "") {
	config.youtrackToken = process.env.YOUTRACK_TOKEN;
}
if (config.youtrackServername == "") {
  config.youtrackServername = process.env.YOUTRACK_SERVERNAME;
}
if (config.youtrackProjectId == "") {
  config.youtrackProjectId = process.env.YOUTRACK_PROJECT_ID;
}
if (config.youtrackProjectName == "") {
  config.youtrackProjectName = process.env.YOUTRACK_PROJECT_NAME;
}

// Config data validation
if (config.githubToken == "" || config.githubToken == undefined) {
  console.error("Failed to load github token. Please provide it via environment variable or hardcode in program");
  throw "Failed to load github token. Please provide it via environment variable or hardcode in program";
}
if (config.githubRepo == "" || config.githubRepo == undefined) {
  console.error("No repo to poll provided. Please provide it via environment variable or hardcode in program");
  throw "No repo to poll provided. Please provide it via environment variable or hardcode in program";
}
if (config.youtrackToken == "" || config.youtrackToken == undefined) {
  console.error("Failed to load you track token. Please provide it via environment variable or hardcode in program");
  throw "Failed to load you track token. Please provide it via environment variable or hardcode in program";
}
if (config.youtrackServername == "" || config.youtrackServername == undefined) {
  console.error("Failed to load youtrack servername. Please provide it via environment variable or hardcode in program");
  throw "Failed to load youtrack servername. Please provide it via environment variable or hardcode in program";
}
// If no project id but project name, load project id form server
if (config.youtrackProjectId == "" || config.youtrackProjectId == undefined) {
  if (config.youtrackProjectName == "" || config.youtrackProjectName == undefined) {
    console.error("Neither Project Id nor Project name was provided. Please provide it via environment variable or hardcode in program");
    throw "Neither Project Id nor Project name was provided. Please provide it via environment variable or hardcode in program";
  }
  else {
    // load project id from project name
    let responce = await fetch(`https://${config.youtrackServername}.youtrack.cloud/api/admin/projects?fields=id,name,shortName&query=${config.youtrackProjectName}`,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": 'Bearer ' + config.youtrackToken,
          "Content-Type": "application/json"
        }
      }
    );
    if (responce.ok) {
      let body = await responce.json();
      printDebug(body, config);
      printDebug(body[0]["id"], config);
      config.youtrackProjectId = body[0]["id"];
    }
  }
}

// Dumping final app config
printDebug(config, config);

//Now app is fully configured and we can start with task

// Getting issues from GitHub
printDebug(`Polling: GET /repos/${config.repo}/issues`, config);
console.log("Getting issues from GitHub");

const octokit = new Octokit({
  auth: config.githubToken,
})
let result = await octokit.request(`GET /repos/${config.githubRepo}/issues`, {
  state: "all",
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

console.log(`Got ${result.data.length} issues from GitHub`);

printDebug(result.status, config);
printDebug(result.data, config);
if (result.status != 200) {
  console.error("Error loading data from github");
  throw "Failed to load data from github";
}


//Creating issues in YouTrack
console.log("Pushing issues to YouTrack!");
//Extracting important data
// separated in two steps that could be one to easier change any of steps in case needed
result.data
.map(
  (issueJson) => ({
    "title": issueJson["title"],
    "url": issueJson["html_url"],
    "description": issueJson["body"],
    "assignee": issueJson["assignee"],
    "state": issueJson["state"],
    "userName" : issueJson["user"]["login"],
    "locked": issueJson["locked"],
    "createdAt": issueJson["created_at"],
    "updatedAt": issueJson["updated_at"],
    "activeLockReason": issueJson["active_lock_reason"],
    "closedAt": issueJson["closed_at"],
    "closedBy": issueJson["closed_by"],
    "reactions" : {
      "+1" : issueJson["reactions"]["+1"],
      "-1" : issueJson["reactions"]["-1"],
    },
  })
)
// Preping data to be sent 
.map((issueData) => ({
  "summary": issueData["title"],
  "description": 
    `Go to origin [link](${issueData["url"]})\n` +
    `Created by ${issueData["userName"]} at ${new Date(issueData["createdAt"]).toUTCString()}\n` +
    `Last updated at ${new Date(issueData["updatedAt"]).toUTCString()}\n` +
    `Current state: ${issueData["state"]}\n` +
    `${issueData["assignee"] != null ? `Assigned to ${issueData["assignee"]["login"]}\n` : ""}` +
    `${issueData["locked"] ? `\nLocked, reason: ${issueData["activeLockReason"]}\n` : ""}` +
    `${issueData["state"] == "closed" ? 
      `\nClosed by ${issueData["closedBy"]["login"]} at ${new Date(issueData["closedAt"]).toUTCString()}\n` : ""}` +
    `Reactions:\n` +
      `\t+1: ${issueData["reactions"]["+1"]}\n` +
      `\t-1: ${issueData["reactions"]["-1"]}\n` +
    `${issueData["description"] != null ? `Description: ${issueData["description"]}` : ""}`
}))
// Pushing issues to YouTrack
.forEach(async (entry) => {
  let body = {
    "project": {"id": config.youtrackProjectId},
    ...entry
  };
  printDebug(body, config);
  let result = await fetch(`https://${config.youtrackServername}.youtrack.cloud/api/issues`,
    {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": 'Bearer ' + config.youtrackToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
    }
  );
  printDebug(result.ok, config);
  let responceBody = await result.text();
  if (!result.ok) {
    console.error("Exiting with error: ", responceBody);
    throw responceBody;
  }
  printDebug(responceBody, config);
  console.log(`Issue "${body["summary"]}" successfully pushed`);
});


