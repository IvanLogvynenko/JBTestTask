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

  pollInterval: 0,

  debug: false,
  // debug: true,
};

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
if (config.pollInterval == 0 || config.pollInterval == "") {
  config.pollInterval = process.env.POLL_INTERVAL;
}

// Config data validation
if (config.githubToken == undefined || config.githubToken == '') {
  console.error("Failed to load github token. Please provide it via environment variable or hardcode in program");
  throw "Failed to load github token. Please provide it via environment variable or hardcode in program"
}
if (config.githubRepo == undefined || config.githubRepo == '') {
  console.error("No repo to poll provided. Please provide it via environment variable or hardcode in program");
  throw "No repo to poll provided. Please provide it via environment variable or hardcode in program";
}
if (config.youtrackToken == undefined || config.youtrackToken == '') {
  console.error("Failed to load you track token. Please provide it via environment variable or hardcode in program");
  throw "Failed to load you track token. Please provide it via environment variable or hardcode in program";
}
if (config.youtrackServername == undefined || config.youtrackServername == '') {
  console.error("Failed to load youtrack servername. Please provide it via environment variable or hardcode in program");
  throw "Failed to load youtrack servername. Please provide it via environment variable or hardcode in program";
}
// If no project id but project name, load project id
if (config.youtrackProjectId == undefined || config.youtrackProjectId == '') {
  if (config.youtrackProjectName == undefined || config.youtrackProjectName == '') {
    console.error("Neither Project Id nor Project name was provided. Please provide it via environment variable or hardcode in program");
    throw "Neither Project Id nor Project name was provided. Please provide it via environment variable or hardcode in program";
  }
  else {
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
if (config.pollInterval == undefined || config.pollInterval == '' || config.pollInterval == 0) {
  console.error("Failed to polling interval. Please provide it via environment variable or hardcode in program");
  throw "Failed to polling interval. Please provide it via environment variable or hardcode in program";
}
if (config.pollInterval < 1000) {
  console.warn("Polling interval is less then a second, consider using bigger interval to avoid overloading your CPU");
}
if (config.pollInterval > 10000) {
  console.warn("Polling interval is more then 10 seconds, consider using smaller interval to keep your data updated");
}

// Dumping final app config
printDebug(config, config);

/**
 * 
 * @param {string} description string description from youtrack
 * @param {config} config config struct
 * 
 * Takes descriptions and parses it to get TimeDate when issue was last updated
 */
function getUpdateDate(description, config) {
  const matched = description.match(/Last updated at (.+ GMT)/);
  printDebug(matched[1], config);
  return new Date(matched[1]);
}

// Using continuous polling, as resources for creating webhook exceed this task scope
setInterval(async () => {
  let youtrackResponce = await fetch(
    'https://ivanlogvynenko.youtrack.cloud/api/issues?fields=id,summary,description',
    {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.youtrackToken,
      }
    }
  );

  let youtrackIssues = await youtrackResponce.json();
  if (!youtrackResponce.ok) {
    printDebug(youtrackResponce.status, config);
    console.error(youtrackIssues, config);
    throw youtrackIssues;
  }

  let lastUpdateProject = new Date(0);
  youtrackIssues.forEach((issue) => {
    printDebug(issue, config);
    const lastUpdateIssue = getUpdateDate(issue["description"], config);
    if (lastUpdateProject < lastUpdateIssue) {
      lastUpdateProject = lastUpdateIssue;
    }
  });

  printDebug(lastUpdateProject, config);

  // We got timestamp of last update, querying updates from github
  let timeSelector = lastUpdateProject.getTime() != 0 ? `?since=${lastUpdateProject.toISOString()}` : "";
  printDebug(`Polling: GET /repos/${config.githubRepo}/issues${timeSelector}`, config);
  console.log("Getting issues updates from GitHub");
  const octokit = new Octokit({
    auth: config.githubToken,
  })
  let githubUpdates = await octokit.request(`GET /repos/${config.githubRepo}/issues${timeSelector}`, {
    state: "all",
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  printDebug(githubUpdates.status, config);
  if (githubUpdates.status != 200) {
    console.error("Error loading data from github");
    throw "Failed to load data from github";
  }

  console.log(`Got ${githubUpdates.data.length} updates from GitHub`);
  printDebug(githubUpdates.data, config);

  console.log("Updating Issues in YouTrack!");
  let issuesToUpdate = githubUpdates.data.filter((update) => new Date(update["updated_at"]) > lastUpdateProject);
  console.log(`Found ${issuesToUpdate.length} issues to update`);
  issuesToUpdate.map(
      (issueJson) => ({
        "title": issueJson["title"],
        "url": issueJson["html_url"],
        "description": issueJson["body"],
        "assignee": issueJson["assignee"],
        "state": issueJson["state"],
        "userName": issueJson["user"]["login"],
        "locked": issueJson["locked"],
        "createdAt": issueJson["created_at"],
        "updatedAt": issueJson["updated_at"],
        "activeLockReason": issueJson["active_lock_reason"],
        "closedAt": issueJson["closed_at"],
        "closedBy": issueJson["closed_by"],
        "reactions": {
          "+1": issueJson["reactions"]["+1"],
          "-1": issueJson["reactions"]["-1"],
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
      let task = youtrackIssues.filter(issue => issue["summary"] == entry["summary"]);
      let taskId = "";
      if (task != undefined && task.length != 0) {
        taskId = task[0]["id"];
      }

      printDebug(taskId, config);
      let body = {
        "project": { "id": config.youtrackProjectId },
        ...entry
      };

      printDebug(body, config);
      let result = await fetch(`https://${config.youtrackServername}.youtrack.cloud/api/issues/${taskId}`,
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
      console.log(`Issue "${body["summary"]}" successfully updated`);
    });
}, config.pollInterval);