'use strict';

const AWS = require('aws-sdk');
const req = require('request-promise-native');
const semver = require('semver');

module.exports.check = (event, context, callback) => {
  Promise.all(
    getLatestKnownVersionForAllApps(),
    getITunesInfoForAllApps()
  ).then(([knownVersions, iTunesVersions]) => {
    iTunesVersions.forEach((info) => {
      const app = info.results[0];
      if (isNew(app.version, knownVersions[app.artistId])) {
        saveNewVersionInfo(app);
        notify(app);
      }
    });
  });
};

// ----- Saving info -----

function saveNewVersionInfo(app) {
  updateLatestVersion(app.artistId, app.version);
  saveVersionInfo(app);
}

function updateLatestVersion(appId, version) {
  const params = {
    TableName: 'creature_latest_releases',
    Item: {
      app_id: { N: appId },
      latest_version: { S: version }
    }
  }
  dynamoClient().putItem(params, (result) => {
    console.log('Updated latest version of ' + appId + ' to ' + version);
  });
}

function saveVersionInfo(app) {
  const params = {
    TableName: 'creature_releases_table',
    Item: {
      app_id: { N: app.artistId },
      app_name: { S: app.trackName },
      version: { S: app.version },
      release_notes: { S: app.releaseNotes },
      release_date: { S: app.currentVersionReleaseDate },
      raw_response: { S: JSON.stringify(app) }
    }
  }
  dynamoClient().putItem(params, (result) => {
    console.log('Saved release info for ' + app.artistId);
  });
}

// ----- Notifications -----

function notify(app) {
  // TODO Implement me!
}

// ----- Fetching info from iTunes API -----

function getITunesInfoForAllApps() {
  let requests = [];
  getIdList().forEach((id) => {
    requests.push(checkApp(id));
  });
  return Promise.all(requests);
}

function checkApp(id) {
  const baseUrl = 'https://itunes.apple.com/lookup?id=';
  const url = baseUrl + id;
  return req({uri: url, json: true})
    .catch((err) => console.log(err));
}

function getIdList() {
  let envIds = process.env.APP_ID_LIST;
  if (envIds) {
    return envIds.split(',');
  }
  return [];
}

function isNew(version, lastKnownVersion) {
  return (version && (!lastKnownVersion || semver.gt(version, lastKnownVersion)));
}

// ----- DynamoDB Stuff -----

function getLatestKnownVersionForAllApps() {
  let params = {
    TableName: 'creature_latest_releases',
    AttributesToGet: ['app_id', 'latest_version']
  }
  return new Promise((resolve, reject) => {
    dynamoClient().scan(params, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      let versions = {};
      data.Items.forEach((app) => {
        versions[app.app_id] = app.latest_version;
      })
      resolve(versions);
    });
  });
}

function dynamoClient() {
  return new AWS.DynamoDB.DocumentClient();
}
