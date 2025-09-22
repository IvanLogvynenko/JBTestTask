# JBTestTask

(Video)[https://youtu.be/DHSo2JbLcqU?si=WjMXFcV7tyTo5XkJ] in which I explain every design decision and code overall

# Part I

## Description

With help of octokit I query data from github, process it into YouTrack style and submit to youtrack.

## Execution

### Shell

```sh
node part1.js
```

Logs:
![oops, idk what happened, image should be here](/images/part1_logs.png "Part 1 Logs")

### Docker

#### Build

```sh
docker build -t part1 -f Dockerfile-part1 .
```

#### Run
Loading tokens from `.env` file:
```sh
docker run --env-file .env -d --name JetBrainsTestTaskPartOne part1:latest
```

#### View logs
```sh
docker logs JetBrainsTestTaskPartOne
```

Docker Logs:
![oops, idk what happened, image should be here](/images/part1_docker_logs.png "Part 1 Docker Logs")


## Configuration

There aren't much variables so here is their purpose

 - GITHUB_TOKEN - Token to access git hub and exec git hub rest api requests
 - GITHUB_REPO - Repo from which issues are to be loaded
 - YOUTRACK_TOKEN - Token to access YouTrack and exec YouTrack rest api requests
 - YOUTRACK_SERVERNAME - Servername is name that is in your YouTrack server. E.g in my_server.youtrack.cloud my_server is server name
 - YOUTRACK_PROJECT_ID - Id of project that should get updated
 - YOUTRACK_PROJECT_NAME - If no id is given/known, just give here name that will be passed to server to query server id. If several projects get returned in query, app will take first one

Tokens can be loaded from .env file or passed with -e one by one

### Not in Docker

In part1.js there is `config` object, where you can paste values. You can also do this via environment variables
```sh
export VAR_NAME=Value
```
My program will read this values only if values in config object are empty

### Docker

Setting environment variables in docker is easier. Just go to docker file and set values. Again values in config object must be empty.

## Debuging

Just set debug in config struct to true to allow printing of debug info (false by default)

# Part II

## Description

Using code from part I, I updated it to run at configurable interval (continious polling) and update/create issues that were changed/created in github after last issue update in youtrack

## Execution

```sh
node part2.js
```

Or in docker (recommended)

Build:
```sh
docker build -t part2 -f Dockerfile-part2 .
```
Run:
```sh
docker run --env-file .env --rm -d --name JetBrainsTestTaskPartTwo part2:latest
```
View logs:
```sh
docker logs -f JetBrainsTestTaskPartTwo
```
Stop:
```sh
docker stop JetBrainsTestTaskPartTwo
```
Note: container will get deleted after stopping, to avoid this remove `--rm` from run command

## Logs

![oops, idk what happened, image should be here](/images/part2_docker_logs.png "Part 2 Docker Logs")