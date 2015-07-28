var childProcess = require('child_process');
var spawn = childProcess.spawn;
var RSVP  = require('rsvp');
var fs    = require('fs');

'use strict';

function exec(method, args) {
    var deferred = RSVP.defer();
    args = [].slice.call(arguments, 0);
    var cp;

    args.push(function (err, stdout, stderr) {
        if (err) {
            var commandStr = args[0] + (Array.isArray(args[1]) ? (' ' + args[1].join(' ')) : '');
            err.message += ' `' + commandStr + '` (exited with error code ' + err.code + ')';
            err.stdout = stdout;
            err.stderr = stderr;
            deferred.reject(err);
        }
        else {
            deferred.resolve({
                childProcess: cp,
                stdout: stdout,
                stderr: stderr
            });
        }
    });
    cp = childProcess.exec.apply(childProcess, args);
    return deferred.promise;
}


function packageJsonData() {
  return JSON.parse(fs.readFileSync('package.json'));
}

function tagName(variant) {
  var base = packageJsonData().version;
  if (variant) {
    base = base + '-' + variant;
  }
  return base;
}

function commitAllAndTag(variant) {
  return exec('git add -A .')
    .then(function () {
      return exec('git commit -m \"' + 'Tagging release: ' + tagName(variant) + '\"');
    })
    .then(function () {
      return exec('git tag -a v' + tagName(variant) + ' -m "Release v' + tagName(variant) + '"')
    });
}

function publish(variant) {
  return commitAllAndTag(variant);
  // return exec('npm publish')
  //   .then(function () {
  //     console.log('Published package ' + (variant || 'standard'));
  //   })
  //   .catch(function (data) {
  //     console.error('Problem publishing package ' + (variant || 'standard'), data);
  //   });
}


function doPublish() {
  console.log('Publishing standard package');
  return publish()
    .then(function () {
      return exec('node lib/setup-packagejson.js', {
        env: {
          PATH: '/usr/local/bin',
          EMBER_TRY_SCENARIO: 'ember-1.8'
        }
      });
    })
    .then(function () {
      console.log('Publishing legacy package');
      return publish('legacy');
    })
    .then(function () {
      console.log('Publishing complete');
      return exec('node lib/reset-packagejson.js');
    })
    .then(function () {
      return exec('git commit -m "Preparing master for next release"');
    });
}
// console.log(tagName());

doPublish();
