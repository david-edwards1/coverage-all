#!/usr/bin/env node

'use strict'
//======================================
// BuildCoverageFiles utility
//======================================
const fs = require('fs');
const path = require('path');

//--------------------------------------------------
// [MIT](https://opensource.org/licenses/MIT)
// © 2016 Michael Cavalea - reread function
const getFolderFiles = initial => new Promise((resolve, reject) => {
  let files = []

  fs.readdir(initial, (error, result) => {
    if(error) return reject(error)

    let remaining = result.length

    const check = () => {
      if (!remaining) return resolve(files)
    }

    const update = toAdd => {
      Array.isArray(toAdd)
        ? files = files.concat(toAdd)
        : files.push(toAdd)

      remaining -= 1
      check()
    }

    check()

    result.forEach(item => {
      const location = path.join(initial, item)

      fs.stat(location, (error, details) => {
        if(error) return reject(error)

        details.isDirectory()
          ? getFolderFiles(location).then(update).catch(reject)
          : update(location)
      })
    })
  })
})

//--------------------------------------------------
/*--------------
coverageFiles = [
  {
    filename: "src/main.ts",
    branchesCovered: 1,
    branchesTotal: 2,
    functionsCovered: 3,
    functionsTotal: 4,
    linesCovered: 1,
    linesTotal: 100
  },
]
----------------*/
start();
//--------------------------------------------------
function start() {
  let buf = "";
  let filesAll = [];
  let coverageSearch = {};
  let jsText = "";
  /*--------------
  coverageSearch = {
    "src/main.ts": {
      filename: "src/main.ts",
      branchesCovered: 1,
      branchesTotal: 2,
      functionsCovered: 3,
      functionsTotal: 4,
      linesCovered: 1,
      linesTotal: 100
    },
  }
  ----------------*/

  // load filesAll
  getFolderFiles('src')
  .then(function(filenames) {
    //filesAll = filenames;
    filesAll = fixSlashes(filenames);
    filesAll = sortFilenames(filesAll);
    // console.log("filesAll");
    // console.dir(filesAll);

    // load coverageSearch
    try {
      buf = fs.readFileSync("coverage/lcov.info", "utf8");
    } catch {}
    if (buf.length==0) {
      console.log("Error: File not found: coverage/lcov.info");
    }
    // console.log("buf.length="+buf.length);
    // console.log("lcov last100="+buf.substr(buf.length-100));

    buf = buf.replace(/\\/g, '/');
    coverageSearch = parseLcov(buf);

    // create coverageFiles.js using filesAll and coverageSearch
    jsText = combine(filesAll, coverageSearch);
    try {
      fs.writeFileSync("coverage/coverageFiles.js", jsText);
    } catch {
      console.log("Error: writing file")
      jsText = "";
    }

    copyReportFiles();

    if (jsText.length) {
      console.log("Done: File created: coverage/coverageFiles.js")
    } else {
      console.log("Error: File not created: coverage/coverageFiles.js")
    }

  })
  .catch(error => console.log(error));
}

//--------------------------------------------------
function copyReportFiles() {

  makeFolder("./coverage/css");
  makeFolder("./coverage/js");
  copyFile("index.html");
  copyFile("css/about.css");
  copyFile("css/app.css");
  copyFile("js/about.js");
  copyFile("js/app.js");
  copyFile("js/chunk-vendors.js");
}

function makeFolder(folder) {
  if (!fs.existsSync(folder)){
    fs.mkdirSync(folder);
  }
}

function copyFile(filename) {
  var buf;
  var srcFile = "node_modules/coverage-all/report/" + filename;
  var destFile= "coverage/" + filename;
try {
    buf = fs.readFileSync(srcFile, "utf8");
  } catch {}
  if (buf.length==0) {
    console.log("Error: coverage-all/report file missing: "+filename);
  }

  try {
    fs.writeFileSync(destFile, buf);
  } catch {
    console.log("Error: writing coverage-all report file: "+destFile);
  }
}

function parseLcov(buf) {
  let start=0;
  let stop=0;
  let r=0; // pos of return
  let cov = [];
  let filename;

  let linesCovered=0;
  let linesTotal=0;
  let branchesCovered=0;
  let branchesTotal=0;
  let functionsCovered=0;
  let functionsTotal=0;

  while (1) {
    start = buf.indexOf("\nSF:", start);
    if (start == -1) break;

    start+=4;
    stop = buf.indexOf("\nSF:", start);
    if (stop == -1) stop=buf.length;

    // filename
    r = buf.indexOf("\n", start);
    if (r == -1) break;  // must have return

    filename = buf.substring(start,r);

    linesCovered = extractInt(buf,"LH",start,stop)
    linesTotal = extractInt(buf,"LF",start,stop)

    branchesCovered = extractInt(buf,"BRH",start,stop)
    branchesTotal = extractInt(buf,"BRF",start,stop)

    functionsCovered = extractInt(buf,"FNH",start,stop)
    functionsTotal = extractInt(buf,"FNF",start,stop)

    cov[filename]={
      filename: filename,
      linesCovered: linesCovered,
      linesTotal: linesTotal,
      branchesCovered: branchesCovered,
      branchesTotal: branchesTotal,
      functionsCovered: functionsCovered,
      functionsTotal: functionsTotal
      };

    start = stop;
  }

  return cov;
}

//--------------------------------------------------
function extractInt(buf, code, start, stop) {
  let value = 0;
  let str = "";
  let key = "\n" + code + ":";
  let begin = buf.indexOf(key,start);
  let end = 0;
  if (begin>start) {
    begin += key.length;
    if (begin<stop) {
      end = buf.indexOf("\n",begin);
      if (end>begin) {
        if (end<stop) {
          str = buf.substring(begin,end);
          value = parseInt(str);
          if (isNaN(value)) {
            value = 0;
          }
        }
      }
    }
  }
  return value;
}

//--------------------------------------------------
function combine(fileAll, coverageSearch) {
  let i;
  let coverage = {};
  let buf = "coverageFiles = [\n";
  for (i=0;i<fileAll.length;++i) {
    buf += "{\nfilename: " + '"' + fileAll[i] + '"' + ",\n";
    coverage = coverageSearch[fileAll[i]];
    if (!coverage) {
      coverage = {
        branchesCovered: 0,
        branchesTotal: 0,
        functionsCovered: 0,
        functionsTotal: 0,
        linesCovered: 0,
        linesTotal: 0
      };
    }
    buf += "linesCovered: " + coverage.linesCovered + ",\n";
    buf += "linesTotal: " + coverage.linesTotal + ",\n";
    
    buf += "branchesCovered: " + coverage.branchesCovered + ",\n";
    buf += "branchesTotal: " + coverage.branchesTotal + ",\n";
    
    buf += "functionsCovered: " + coverage.functionsCovered + ",\n";
    buf += "functionsTotal: " + coverage.functionsTotal + "\n},\n";
  }
  buf += "];\n"
  return buf;
}
//--------------------------------------------------
function fixSlashes(filenames) {
  var i;
  for (i=0;i<filenames.length;++i) {
    filenames[i]=filenames[i].replace(/\\/g, '/');
  }
  return filenames;
}

function sortFilenames(filenames) {
  var i;
  var n;
  var len;
  // console.log("build filenames length="+filenames.length);
  // console.log(result);
  //------------
  // list all files in a folder before sub folders
  // add a leading 0 to filename portion before sorting
  for (i=0;i<filenames.length;++i) {
    n=filenames[i].split("/");
    n[n.length-1] = "0" + n[n.length-1];
    filenames[i] = n.join("/");
    // console.log(i+" "+filenames[i]);
  }
  // console.log("");
  filenames.sort();

  // remove the leading 0 from filename portion
  for (i=0;i<filenames.length;++i) {
    n=filenames[i].split("/");
    n[n.length-1] = n[n.length-1].substr(1);
    filenames[i] = n.join("/");
    // console.log(i+" "+filenames[i]);
  }
  // console.log("");

  //------------
  // for (i=0;i<filenames.length;++i) {
  //  console.log(i+" "+filenames[i]);
  // }
  // console.log("");
  return filenames;
}
