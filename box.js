/*
 *
 * the new independent photobox
 *
 */

'use strict';

  var Photobox = require( './lib/photobox' ),
      options  = {
                    indexPath                     : 'photobox',
                    javascriptEnabled             : true,
                    localToRemoteUrlAccessEnabled : true,
                    loadImages                    : true,
                    password                      : '',
                    screenSizes                   : [ '800', '1000' ],
                    template                      : 'magic',
                    userAgent                     : 'Photobox',
                    userName                      : '',
                    urls                          : [ 'http://www.faz.de', 'http://www.google.de' ]
                  },
      done     = true,
      pb       = new Photobox( options, done );

      pb.startPhotoSession();