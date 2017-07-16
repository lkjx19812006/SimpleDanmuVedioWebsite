// Generated by CoffeeScript 1.6.3
(function() {
  var Video, escape, fs, os_path, settings, util;

  os_path = require('path');

  fs = require('fs');

  settings = require('../config');

  Video = require('../model/Video');

  util = require('../modules/util');

  escape = require('escape-html');

  module.exports = function(app) {
    app.get('/video', function(req, res) {
      return Video.find(0, 0, function(err, result) {
        var video, _i, _len;
        if (err) {
          return res.redirect('/404.html');
        } else {
          for (_i = 0, _len = result.length; _i < _len; _i++) {
            video = result[_i];
            video.time = util.getFormatDate(video.time);
            if (!video.play_count) {
              video.play_count = 0;
            }
            if (!video.barrage_count) {
              video.barrage_count = 0;
            }
          }
          return res.render('video_list', {
            videos: result,
            title: '视频列表',
            navAction: {
              url: '/video/add',
              text: '上传视频'
            }
          });
        }
      });
    });
    app.get('/video/av/:name', function(req, res) {
      var name;
      name = req.params.name;
      return Video.findOne(name, function(err, v) {
        if (err) {
          res.redirect('/404.html');
          return;
        }
        v.incPlayCount();
        if (!v.barrage_count) {
          v.barrage_count = 0;
        }
        if (v.barrage) {
          v.barrage.sort(function(a, b) {
            return b.time - a.time;
          });
        }
        return res.render('video', {
          video: v,
          title: v.name
        });
      });
    });
    app.get('/video/add', function(req, res) {
      return res.render('add_video', {
        title: 'Add Video',
        navAction: {
          url: '/video',
          text: '返回列表'
        }
      });
    });
    app.post('/video/add', function(req, res) {
      var video;
      video = {
        name: escape(req.body.name),
        path: req.body.path,
        format: req.body.format,
        time: req.body.time,
        poster: req.body.poster,
        duration: req.body.duration
      };
      return getNextId('video_id', function(err, result) {
        if (err) {
          json_response(res, 'error', null, err.message);
        }
        video.id = result.seq;
        video = new Video(video);
        return video.save(function(err, v) {
          if (err) {
            json_response(res, 'error', null, err.message);
          }
          return json_response(res, 'success', v.id);
        });
      });
    });
    app.post('/video/merge', function(req, res) {
      var filename, identifier;
      filename = req.body.filename;
      identifier = req.body.identifier;
      util = require('../modules/util');
      return util.mergeFile(filename, identifier, function(err, path, format, time) {
        var ffmpeg, proc, thumbPath, video, videoPath;
        if (err) {
          return json_response(res, 'error', null, err.message);
        } else {
          ffmpeg = require('fluent-ffmpeg');
          videoPath = os_path.join(__dirname, '../uploads/' + path);
          thumbPath = os_path.join(__dirname, '../uploads/thumb/');
          video = {
            path: path,
            format: format,
            time: time
          };
          proc = new ffmpeg({
            source: videoPath
          });
          proc.setFfmpegPath(settings.ffmpegPath);
          return proc.withSize('150x150').takeScreenshots({
            count: 1,
            timemarks: ['10%'],
            filename: '%f_thumb_%wx%h_%i'
          }, thumbPath, function(err, fileName) {
            var meta;
            if (!err) {
              video.poster = fileName;
            }
            return meta = new ffmpeg.Metadata(videoPath, function(info, err) {
              if (!err) {
                video.duration = info.durationraw.substr(0, info.durationraw.lastIndexOf('.'));
              }
              return json_response(res, 'success', video);
            });
          });
        }
      });
    });
    app.get('/video/thumbnail/:filename?*', function(req, res) {
      var defaultPath, thumbPath;
      thumbPath = os_path.join(__dirname, '../uploads/thumb/' + req.params.filename);
      defaultPath = os_path.join(__dirname, '../uploads/thumb/thumb_default.png');
      return fs.exists(thumbPath, function(exists) {
        if (exists) {
          return res.sendfile(thumbPath);
        } else {
          return res.sendfile(defaultPath);
        }
      });
    });
    return app.post('/video/convert', function(req, res) {
      var ffmpeg, proc, sourceFormat, sourcePath, targetPath, tempPath, uploadPath;
      res.end('forbid');
      ffmpeg = require('fluent-ffmpeg');
      sourcePath = req.body.video_path;
      console.log(sourcePath);
      if (!sourcePath) {
        json_response(res, 'error', null, 'File not found when converting!');
        return;
      }
      sourceFormat = sourcePath.substr(sourcePath.lastIndexOf('.') + 1);
      if (sourceFormat === 'mp4') {
        json_response(res, 'success', {
          'format': 'mp4',
          'path': sourcePath
        });
        return;
      }
      tempPath = targetPath = sourcePath.substr(0, sourcePath.lastIndexOf('.')) + '.mp4';
      uploadPath = os_path.join(__dirname, '../uploads/');
      sourcePath = os_path.join(uploadPath, sourcePath);
      targetPath = os_path.join(uploadPath, targetPath);
      proc = new ffmpeg({
        source: sourcePath,
        timeout: 3600
      });
      proc.setFfmpegPath(settings.ffmpegPath);
      return proc.withVideoCodec('libx264').onProgress(function(info) {
        return private_video_sockets.emit('convert progress', info);
      }).toFormat('mp4').saveToFile(targetPath, function(stdout, stderr) {
        return json_response(res, 'success', {
          'format': 'mp4',
          'path': tempPath
        });
      });
    });
  };

}).call(this);
