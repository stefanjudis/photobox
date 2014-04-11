/*
 * grunt-photoBox
 * https://github.com/stefan/grunt-photoBox
 *
 * Copyright (c) 2013 stefan judis
 * Licensed under the MIT license.
 */

'use strict';

var fs           = require('fs.extra'),  //require( 'node-fs' ), // require( 'fs' ),
    path         = require( 'path' ),
    _            = require( 'lodash' ),
    childProcess = require( 'child_process' ),
    phantomjs    = require( 'phantomjs' ),
    phantomPath  = phantomjs.path;

/**
 * Constructor for PhotoBox
 *
 * @param  {Object}   grunt    grunt
 * @param  {Object}   options  plugin options
 * @param  {Function} callback callback
 *
 * @tested
 */
var PhotoBox = function( options, callback ) {
  this.callback          = callback;
  this.diffCount         = 0;
  this.options           = options;
  this.options.indexPath = this.getIndexPath();
  this.pictureCount      = 0;

  if ( typeof options.template === 'string' ) {
    this.template = options.template;
  } else if ( typeof options.template === 'object' ) {
    this.template = options.template.name;
  }

  this.movePictures();
  this.pictures = this.getPreparedPictures();

  console.log( 'pics ',  this.pictures );
};


/**
 * Callback for image comparision
 *
 * @param  {String} err     error
 * @param  {Object} result  result
 * @param  {Number} code    exit code
 * @param  {String} picture name of current picture iteration
 */
PhotoBox.prototype.compositeCallback = function( err, result, code, picture ) {
  if ( err ) {
    console.log( err );
  }

  // this.grunt.log.verbose.writeln(
  //   'CompareCallback: Result for ' + picture + ' was ' + result
  // );
  // this.grunt.log.verbose.writeln(
  //   'CompareCallback: Code for ' + picture + ' was ' + code
  // );

  console.log(
    'CompareCallback: Result for ' + picture + ' was ' + result
  );
  console.log(
    'CompareCallback: Code for ' + picture + ' was ' + code
  );


  this.grunt.util.spawn( {
    cmd  : 'convert',
    args : this.getConvertArguments( picture )
  }, function( err, code, result ) {
    this.overlayCallback( err, code, result, picture );
  }.bind( this ) );
};


/**
 * Actuel function to create the diff images
 *
 * @tested
 */
PhotoBox.prototype.createDiffImages = function() {
  var imgPath = this.options.indexPath + 'img/' ;

  // this.grunt.log.subhead( 'PHOTOBOX STARTED DIFF GENERATION.');
  console.log( 'PHOTOBOX STARTED DIFF GENERATION.');

  this.pictures.forEach( function( picture ) {
    // TODO that can be done in on regex
    picture = picture.replace( /(http:\/\/|https:\/\/)/, '')
                      .replace( /(\/)|(\|)/g, '-' )
                      .replace( '#', '-' );

    //this.grunt.log.writeln( 'started diff for ' + picture );
    console.log( 'started diff for ' + picture );

    var oldFileExists = fs.existsSync(
                          this.options.indexPath + 'img/last/' + picture + '.png'
                        );

    var currentFileExists = fs.existsSync(
                              this.options.indexPath + 'img/current/' + picture + '.png'
                            );

    if ( oldFileExists && currentFileExists ) {

      // this.grunt.util.spawn( {
      //   cmd  : 'composite',
      //   args : this.getCompositeArguments( picture )
      // }, function( err, result, code ) {
      //   this.compositeCallback( err, result, code, picture );
      // }.bind ( this ) );

      console.log( '==> COMMAND: ', 'composite ' + this.getCompositeArguments( picture ).join( ' ' ) );

      childProcess.exec( 'composite ' + this.getCompositeArguments( picture ).join( ' ' ),
        function (error, stdout, stderr) {
         if (error) {
           console.log( '--> error.stack ', error.stack);
           console.log( '--> Error code: '+error.code);
           console.log( '--> Signal received: '+error.signal);

         }
         // console.log( '--> Child Process STDOUT: '+stdout);
         // console.log( '--> Child Process STDERR: '+stderr);
       });

    } else {
      console.log(
        'Nothing to diff here - no old pictures available.'
      );

      ++this.diffCount;

      this.tookDiffHandler();
    }
  }.bind( this ) );
};


/**
 * Create index file.
 *
 * @tested
 */
PhotoBox.prototype.createIndexFile = function() {
  // this.grunt.log.subhead( 'PHOTOBOX STARTED INDEX FILE GENERATION' );
  console.log( 'PHOTOBOX STARTED INDEX FILE GENERATION' );

  var templateData = this.pictures.map(
    function( picture ) {
      var split = picture.split('#');

      return {
        url : split[0],
        size: split[1]
      };
    }
  ).reduce( function( prev, current ) {
    if ( !prev[ current.url ] ) {
      prev[ current.url ] = [];
    }

    prev[ current.url ].push( current.size );

    return prev;
  }, {});

  var compiled = _.template(
      fs.readFileSync(
        path.dirname( __dirname ) + '/tpl/' + this.template + '.tpl'
      )
  );

  var result = compiled( {
        now          : + new Date(),
        options      : this.options,
        templateData : templateData,
        timestamps   : this.getTimestamps()
      } );

  fs.writeFileSync( this.options.indexPath + 'index.html', result );

  // this.grunt.log.ok(
  //   'PHOTOBOX CREATED NEW \'index.html\' AT \'' + this.options.indexPath + '\'.'
  // );
  console.log(
    'PHOTOBOX CREATED NEW \'index.html\' AT \'' + this.options.indexPath + '\'.'
  );
};


/**
 * Check if folder of given path exists
 * and if so delete it
 *
 * @param  {Array|String} folder folder path(s)
 */
PhotoBox.prototype.deleteFolder = function( folder ) {
  var options = this.options;

  function deleteIt( folderPath ) {
    console.log( 'delete it' );
    if ( fs.existsSync( options.indexPath + folderPath ) ) {
      //grunt.file.delete( options.indexPath + folderPath );
      childProcess.exec( 'rm -rf ' + options.indexPath + folderPath ,
        function ( error, stdout, stderr) {
          // console.log( 'error::: ', error );
          // console.log( 'stdout::: ', stdout );
          // console.log( 'stderr:::', stderr );
      } );
    }
  }

  if ( folder instanceof Array ) {
    folder.forEach( function( folderPath ) {
      deleteIt( folderPath );
    }.bind( this ) );
  } else {
    deleteIt( folder );
  }
};


/**
 * Getter for in constructor set callback function
 * Mostly for testing purposes
 *
 * @return {Function} callback
 */
PhotoBox.prototype.getCallback = function() {
  return this.callback;
};


/**
 * Helper function to evaluate correct path for index file
 *
 * @return {String} indexPath
 *
 * @tested
 */
PhotoBox.prototype.getIndexPath = function() {
  var indexPath = this.options.indexPath;

  if ( !indexPath ) {
    console.log( 'No indexPath set.' );
  }

  if ( indexPath[ indexPath.length - 1 ] !== '/' ) {
    indexPath += '/';
  }

  return indexPath;
};


/**
 * Helper function to build up the arguments
 * array for the composite command
 *
 * @param  {String} picture picture
 * @return {Array}          Array including all arguments
 */
PhotoBox.prototype.getCompositeArguments = function( picture ) {
  return [
    this.options.indexPath + 'img/current/' + picture + '.png',
    this.options.indexPath + 'img/last/' + picture + '.png',
    '-compose',
    'difference',
    this.options.indexPath + 'img/diff/' + picture + '-diff.png'
  ];
};


/**
 * Helper function to build up the arguments
 * array for the convert command
 *
 * @param  {String} picture picture
 * @return {Array}          Array including all arguments
 */
PhotoBox.prototype.getConvertArguments = function( picture ) {
  return [
    '-negate',
    this.options.indexPath + 'img/diff/' + picture + '-diff.png',
    this.options.indexPath + 'img/diff/' + picture + '.png'
  ];
};


/**
 * Getter for diffCount
 * Mostly for testing purposes
 *
 * @return {Number} pictureCount
 */
PhotoBox.prototype.getDiffCount = function() {
  return this.diffCount;
};


/**
 * Getter for options
 * Mostly for testing purposes
 *
 * @return {Object} options
 */
PhotoBox.prototype.getOptions = function() {
  return this.options;
};


/**
 * Getter for pictureCount
 * Mostly for testing purposes
 *
 * @return {Number} pictureCount
 */
PhotoBox.prototype.getPictureCount = function() {
  return this.pictureCount;
};


/**
 * Getter for pictures array.
 * Mostly for testing purposes
 *
 * @return {Array} pictures
 */
PhotoBox.prototype.getPictures = function() {
  return this.pictures || null;
};


/**
 * Get prepared picture array.
 *
 * @return {Array} Array with concatenated picture information
 *
 * @tested
 */
PhotoBox.prototype.getPreparedPictures = function() {
  var pictures = [];

  this.options.urls.forEach( function( url ) {
    this.options.screenSizes.forEach( function( size ) {
      pictures.push( url + '#' + size );

      if ( size.match( /x/gi ) ) {
        // this.grunt.log.warn(
        //   '\nYay!!! You updated to version 0.5.0., which includes the feature of flexible height screenshots.\n' +
        //   'Unfortunately the cleanest solution was to make version 0.4.x incompatible with version 0.5.0.\n' +
        //   'Please check documentation how to configure \'screenSizes\' options in version 0.5.0 and later.\n\n' +
        //   '--> https://github.com/stefanjudis/grunt-photobox\n'
        // );
        // this.grunt.fatal( 'Sorry have to quit. :(' );
        console.log(
          '\nYay!!! You updated to version 0.5.0., which includes the feature of flexible height screenshots.\n' +
          'Unfortunately the cleanest solution was to make version 0.4.x incompatible with version 0.5.0.\n' +
          'Please check documentation how to configure \'screenSizes\' options in version 0.5.0 and later.\n\n' +
          '--> https://github.com/stefanjudis/grunt-photobox\n'
        );
        console.log( 'Sorry have to quit. :(' );
      }
    }, this );
  }, this );

  return pictures;
};


/**
 * Get timestampe for given file by reading timestamp.json file
 *
 * @param  {String} name name
 * @return {String}      actual timestamp
 *
 * @tested
 */
PhotoBox.prototype.getTimestamp = function( name ) {
  var timestampContent,
      timestamp;

  try {
    timestampContent = fs.readFileSync(
                            this.options.indexPath + '/img/' + name + '/timestamp.json'
                          );

    timestamp = JSON.parse( timestampContent ).timestamp;
  } catch ( e ) {
    console.log(
      'Something went wrong with reading timestamp file for ' + name + ' photosession'
    );

    timestamp = 'Not available';
  }

  return timestamp;
};


/**
 * Get object with current and last timestamps
 *
 * @return {Object} timestamps
 *
 * @tested
 */
PhotoBox.prototype.getTimestamps = function() {
  return {
    current : this.getTimestamp( 'current' ),
    last    : this.getTimestamp( 'last' )
  };
};


/**
 * Move current pictures to latest directory
 *
 * @tested
 */
PhotoBox.prototype.movePictures = function() {
  //this.deleteFolder( [ 'img/last', 'img/diff' ] );

  console.log( '==> movePictures' );
  var options = this.options;
  // delete old diff folder and images


  // TODO: clean this up
  fs.remove( this.options.indexPath + 'img/diff', function(err){
    if (err) {
     return console.error(err);
    }

    console.log('success! removed: img/diff')
    // create new diff folder - imageMagick is not able to create it on its own
    fs.mkdirSync( options.indexPath + 'img/diff', '0777', true );
  });


  fs.remove( this.options.indexPath + 'img/last', function(err){
    if (err) {
     return console.error(err);
    }

    console.log('success! removed: img/last');

    // move current picture to old pictures
    if ( !fs.existsSync( options.indexPath + '/img/current' ) ) {
      console.log(
        'No old pictures are existant.'
      );
    } else {
      console.log( '???? RENAME' );
      fs.renameSync(
        options.indexPath + 'img/current',
        options.indexPath + 'img/last'
      );
    }

  });


};


/**
 * Callback for image overlay operation
 *
 * @param  {String} err     error
 * @param  {Object} result  result
 * @param  {Number} code    exit code
 * @param  {String} picture name of current picture iteration
 *
 * @tested
 */
PhotoBox.prototype.overlayCallback = function( err, result, code, picture ) {
  if ( err ) {
    console.log( err );
  } else {
    //this.grunt.log.ok( 'diff for ' + picture + ' generated.' );
    console.log( 'diff for ' + picture + ' generated.' );
  }

  // this.grunt.log.verbose.writeln(
  //   'OverlayCallback: Result for ' + picture + ' was ' + result
  // );
  // this.grunt.log.verbose.writeln(
  //   'OverlayCallback: Code for ' + picture + ' was ' + code
  // );

console.log(
    'OverlayCallback: Result for ' + picture + ' was ' + result
  );
  console.log(
    'OverlayCallback: Code for ' + picture + ' was ' + code
  );

  ++this.diffCount;

  this.tookDiffHandler();
};


/**
 * Callback after phantomjs operation
 *
 * @param  {String} err     error
 * @param  {Object} result  result
 * @param  {Number} code    exit code
 * @param  {String} picture name of current picture iteration
 *
 * @tested
 */
PhotoBox.prototype.photoSessionCallback = function( err, result, code, picture ) {
  if ( err ) {
    console.log( 'Takin\' picture of ' + picture + 'did not work correclty...' );
    //this.grunt.log.writeln( err );
    console.log( err );
  } else {

    // this.grunt.log.ok( 'picture of ' + picture + ' taken.' );
    console.log( 'picture of ' + picture + ' taken.' );

  }

  // this.grunt.log.verbose.writeln(
  //   'PhotoSessionCallback: Result for ' + picture + ' was ' + result
  // );
  // this.grunt.log.verbose.writeln(
  //   'PhotoSessionCallback: Code for ' + picture + ' was ' + code
  // );

console.log(
    'PhotoSessionCallback: Result for ' + picture + ' was ' + result
  );
  console.log(
    'PhotoSessionCallback: Code for ' + picture + ' was ' + code
  );

  ++this.pictureCount;

  this.tookPictureHandler();
};


/**
 * Setter for picture count
 * Mostly for testing purposes
 *
 * @param  {Number} count count
 * @return {Number}       new set count
 */
PhotoBox.prototype.setPictureCount = function( count ) {
  this.pictureCount = count;

  return this.pictureCount;
};


/**
 * Start a session of taking pictures
 *
 * @tested
 */
PhotoBox.prototype.startPhotoSession = function() {
  //this.grunt.log.subhead( 'PHOTOBOX STARTED PHOTO SESSION.' );
  console.log( 'PHOTOBOX STARTED PHOTO SESSION.' );

  this.writeTimestampFile();

  this.writeOptionsFile( {
    javascriptEnabled             : this.options.javascriptEnabled,
    loadImages                    : this.options.localToRemoteUrlAccessEnabled,
    localToRemoteUrlAccessEnabled : this.options.localToRemoteUrlAccessEnabled,
    password                      : this.options.password,
    userAgent                     : this.options.userAgent,
    userName                      : this.options.userName
  } );

  this.pictures.forEach( function( picture ) {
    // this.grunt.log.writeln( 'started photo session for ' + picture );
    console.log( 'started photo session for ' + picture );

    var args = [
      path.resolve( __dirname, 'photoboxScript.js' ),
      picture,
      this.options.indexPath,
      this.options.indexPath + 'options.json'
    ];

    var opts = {};

    // this.grunt.log.verbose.writeln( 'Command: phantomjs ' + args.join( ' ' ) + '\n' );
    console.log( 'Command: phantomjs ' + args.join( ' ' ) + '\n' );

    childProcess.exec( 'phantomjs ' + args.join( ' ' ) ,
      function ( error, stdout, stderr) {
        // console.log( '----' );
        // console.log( 'error::: ', error );
        // console.log( 'stdout::: ', stdout );
        // console.log( 'stderr:::', stderr );
        // console.log( '----' );
        var result = {
                        stdout : stdout,
                        stderr : stderr,
                        code   : '???'
                      };
        var code    = '???'
        this.photoSessionCallback( error, result, code, picture );
    }.bind( this ) );

  }.bind( this ) );
};


/**
 * Handler for emitted 'tookDiff'
 */
PhotoBox.prototype.tookDiffHandler = function() {
  if ( this.diffCount === this.pictures.length ) {

    // this.grunt.log.ok( 'PHOTOBOX FINISHED DIFF GENERATION SUCCESSFULLY.' );
    console.log( 'PHOTOBOX FINISHED DIFF GENERATION SUCCESSFULLY.' );

    this.createIndexFile( 'default' );
    // call done() to exit grunt task
    //this.callback();
  }
};


/**
 * Handler for emitted 'tookPicture'
 *
 * @tested
 */
PhotoBox.prototype.tookPictureHandler = function() {
  if ( this.pictureCount === this.pictures.length ) {

    // this.grunt.log.ok( 'PHOTOBOX FINISHED PHOTO SESSION SUCCESSFULLY.' );
    console.log( 'PHOTOBOX FINISHED PHOTO SESSION SUCCESSFULLY.' );

    if ( this.template === 'magic' ) {
      // this.grunt.log.writeln(
      //   '\nNOTE: You defined to use ImageMagick, make sure it is installed.'
      // );
      console.log(
        '\nNOTE: You defined to use ImageMagick, make sure it is installed.'
      );

      this.createDiffImages();
    } else {
      if ( this.template === 'canvas' ) {

        if ( !fs.existsSync( this.options.indexPath + 'scripts/worker.js' ) ) {

          fs.copy(
            path.dirname( __dirname ) + '/assets/scripts/worker.js', // source file
            this.options.indexPath + 'scripts/worker.js',    // target file
            function (err) {
            if (err) {
              throw err;
            }
            console.log('Copied worker.js');
          });

        }

      }

      this.createIndexFile();
    }
  }
};


/**
 * Write options file to pass it to
 * phantomjs
 * -> JSON.stringify brings only troubles
 *     as a system argument
 *
 * @param  {Object} options options
 *
 * @tested
 */
PhotoBox.prototype.writeOptionsFile = function( options ) {
  fs.writeFileSync(
    this.options.indexPath + 'options.json',
    JSON.stringify( options )
  );
};


/**
 * Write JSON file to store timestamp
 * of current photosession
 *
 * @tested
 */
PhotoBox.prototype.writeTimestampFile = function() {
  var date       = new Date(),
      dateString = date.toString();

  if ( !fs.existsSync( this.options.indexPath + 'img/current' ) ) {
    fs.mkdirSync( this.options.indexPath + 'img/current', '0777', true );
  }

  fs.writeFileSync(
    this.options.indexPath + 'img/current/timestamp.json',
    JSON.stringify( {
      timestamp: dateString
    } )
  );

  // this.grunt.log.verbose.writeln(
  //   'Wrote timestamp file with ' + dateString + '.'
  // );
  //
  console.log(
    'Wrote timestamp file with ' + dateString + '.'
  );
};


module.exports = PhotoBox;
