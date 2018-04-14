(function (exports) {
	var Record = function (options) {
		var defaultOptions = {
			//开始录音
			onStartRecord: function () {
			},
			//录音中
			onRecording: function () {
			},
			//上传文件成功
			onRecordUpload: function () {
			},
			//recorder.swf引用路径
			swfSrc: "./resources/js/recorder.swf",
			//录音上传的url
			uploadUrl: "/cloud/mcs/api/v1/encoder/wav2amr",
			//错误提示语
			errorMsg: "录音初始化错误!",
		};
		this.audioInput = null;
		this.audioRecorder = null;
		this.audioContext = null;
		this.audioTimer = null;

		this.currentOptions = $.extend({}, defaultOptions, options);
		this.init();
	};

	Record.prototype = {
		//初始化
		init: function () {
			var t = this;
			this.getUserMedia = null;
			//初始化声音库
			RongIMLib.RongIMVoice.init();

			//录音初始化--调用麦克风
			switch (this.getBrowserType()) {
				case "Firefox":
					/*this.getUserMedia = navigator.getUserMedia || navigator.mediaDevices.getUserMedia;
					this.getUserMedia({audio: true}, function (stream) {
						t.successInitGetUserMedia(stream, this);
					}, function (error) {
						t.errorInitGetUserMedia(error);
					});
					break;*/
				case "Chrome":
					this.getUserMedia = navigator.getUserMedia || navigator.mediaDevices.getUserMedia;
					this.getUserMedia({audio: true}).then(function (stream) {
						t.successInitGetUserMedia(stream, this);
					}).catch(function (error) {
						t.errorInitGetUserMedia(error);
					});
					break;
				default:
					Recorder.initialize({
						swfSrc: this.currentOptions.swfSrc
					});
			}
		},
		//开始录音
		startRecord: function () {
			var tCurOp = this.currentOptions;
			var t = this;
			if (this.getUserMedia) {
				if (this.audioInput && this.audioRecorder && this.audioContext) {
					this.audioInput.connect(this.audioRecorder);
					this.audioRecorder.connect(this.audioContext.destination);
					tCurOp.onStartRecord();
					var time = 0;
					this.audioTimer = setInterval(function () {
						time += 300;
						tCurOp.onRecording(time);
					}, 300);
				} else {
					alert(tCurOp.errorMsg)
				}
			} else {
				Recorder.record({
					start: function () {
						tCurOp.onStartRecord();
					},
					progress: function (milliseconds) {
						tCurOp.onRecording(milliseconds);
					}
				});
			}
		},
		//结束录音
		stopRecord: function () {
			var tCurOp = this.currentOptions;
			if (this.getUserMedia) {
				clearInterval(this.audioTimer);
				if (this.audioRecorder) {
					this.audioInput.disconnect();
					this.audioRecorder.disconnect();
				} else {
					alert(tCurOp.errorMsg)
				}
			} else {
				Recorder.stop();
			}
		},
		//上传录音，获取base64的.amr格式录音
		uploadRecord: function () {
			var tCurOp = this.currentOptions;
			if (this.getUserMedia) {
				var fd = new FormData();
				fd.append('file', this.getBlob());
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function () {
					if (xhr.readyState === 4 && xhr.status === 200) {
						tCurOp.onRecordUpload(xhr.responseText);
					}
				};
				xhr.open("POST", tCurOp.uploadUrl, true);
				xhr.send(fd);
			} else {
				Recorder.upload({
					url: tCurOp.uploadUrl,
					audioParam: "file",
					success: function (res) {
						tCurOp.onRecordUpload(res);
					}
				});
			}
		},
		//播放录音
		playRecord: function (voice) {
			if (voice) {
				// 音频持续大概时间(秒)
				var duration = voice.length / 1024;
				RongIMLib.RongIMVoice.preLoaded(voice, function () {
					RongIMLib.RongIMVoice.play(voice, duration);
				});
			} else {
				console.error('请传入 amr 格式的 base64 音频文件');
			}
		},
		//获取音频文件 type:WAV || MP3
		getBlob: function () {
			this.stopRecord();
			return this.audioData.encodeWAV();
		},
		//获取浏览器类型
		getBrowserType: function () {
			//取得浏览器的userAgent字符串
			var userAgent = navigator.userAgent;

			if (userAgent.indexOf("Opera") > -1) {
				//判断是否Opera浏览器
				return "Opera"
			} else if (userAgent.indexOf("Firefox") > -1) {
				//判断是否Firefox浏览器
				return "Firefox";
			} else
			//判断是否chorme浏览器
			if (userAgent.indexOf("Chrome") > -1) {
				return "Chrome";
			} else if (userAgent.indexOf("Safari") > -1) {
				//判断是否Safari浏览器
				return "Safari";
			} else if (userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && userAgent.indexOf("Opera") === -1) {
				//判断是否IE浏览器
				return "IE";
			} else if (userAgent.indexOf("Trident") > -1 || userAgent.indexOf("Edge") > -1) {
				//判断是否Edge浏览器
				return "Edge";
			}
		},
		//html5初始化成功方法
		successInitGetUserMedia: function (stream, t) {
			var audioContext = window.AudioContext || window.webkitAudioContext || window.webkitAudioContext;
			var context = new audioContext();

			//将声音输入这个对像
			var audioInput = context.createMediaStreamSource(stream);

			//设置音量节点
			var volume = context.createGain();
			audioInput.connect(volume);

			//创建缓存，用来缓存声音
			var bufferSize = 16384;

			// 创建声音的缓存节点，createScriptProcessor方法的
			// 第二个和第三个参数指的是输入和输出都是单声道。
			var audioRecorder = context.createScriptProcessor(bufferSize, 1, 1);

			//audio的方法和参数
			var audioData = {
				size: 0,         //录音文件长度
				buffer: [],     //录音缓存
				inputSampleRate: context.sampleRate,     //输入采样率
				inputSampleBits: 16,      //输入采样数位 8, 16
				outputSampleRate: 44100 / 6,   //输出采样率
				oututSampleBits: 8,        //输出采样数位 8, 16
				//输入
				input: function (data) {
					this.buffer.push(new Float32Array(data));
					this.size += data.length;
				},
				//合并压缩
				compress: function () {
					//合并
					var data = new Float32Array(this.size);
					var offset = 0;
					for (var i = 0; i < this.buffer.length; i++) {
						data.set(this.buffer[i], offset);
						offset += this.buffer[i].length;
					}
					//压缩
					var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
					var length = data.length / compression;
					var result = new Float32Array(length);
					var index = 0, j = 0;
					while (index < length) {
						result[index] = data[j];
						j += compression;
						index++;
					}
					this.size = 0;
					this.buffer = [];
					return result;
				},
				//返回wav格式音频
				encodeWAV: function () {
					var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
					var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
					var bytes = this.compress();
					var dataLength = bytes.length * (sampleBits / 8);
					var buffer = new ArrayBuffer(44 + dataLength);
					var data = new DataView(buffer);

					var channelCount = 1;//单声道
					var offset = 0;

					var writeString = function (str) {
						for (var i = 0; i < str.length; i++) {
							data.setUint8(offset + i, str.charCodeAt(i));
						}
					};
					// 资源交换文件标识符
					writeString('RIFF');
					offset += 4;
					// 下个地址开始到文件尾总字节数,即文件大小-8
					data.setUint32(offset, 36 + dataLength, true);
					offset += 4;
					// WAV文件标志
					writeString('WAVE');
					offset += 4;
					// 波形格式标志
					writeString('fmt ');
					offset += 4;
					// 过滤字节,一般为 0x10 = 16
					data.setUint32(offset, 16, true);
					offset += 4;
					// 格式类别 (PCM形式采样数据)
					data.setUint16(offset, 1, true);
					offset += 2;
					// 通道数
					data.setUint16(offset, channelCount, true);
					offset += 2;
					// 采样率,每秒样本数,表示每个通道的播放速度
					data.setUint32(offset, sampleRate, true);
					offset += 4;
					// 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
					data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true);
					offset += 4;
					// 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
					data.setUint16(offset, channelCount * (sampleBits / 8), true);
					offset += 2;
					// 每样本数据位数
					data.setUint16(offset, sampleBits, true);
					offset += 2;
					// 数据标识符
					writeString('data');
					offset += 4;
					// 采样数据总数,即数据总大小-44
					data.setUint32(offset, dataLength, true);
					offset += 4;
					// 写入采样数据
					if (sampleBits === 8) {
						for (var i = 0; i < bytes.length; i++, offset++) {
							var s = Math.max(-1, Math.min(1, bytes[i]));
							var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
							val = parseInt(255 / (65535 / (val + 32768)));
							data.setInt8(offset, val, true);
						}
					} else {
						for (var i = 0; i < bytes.length; i++, offset += 2) {
							var s = Math.max(-1, Math.min(1, bytes[i]));
							data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
						}
					}

					return new Blob([data], {type: 'audio/wav'});
				},

				//返回mps格式音频
				encodeMps: function () {

				}
			};

			//监听开始录音
			audioRecorder.onaudioprocess = function (event) {
				audioData.input(event.inputBuffer.getChannelData(0));
			};

			//暴露方法
			this.audioInput = audioInput;
			this.audioRecorder = audioRecorder;
			this.audioData = audioData;
			this.audioContext = context;
		},
		//html5初始化失败方法
		errorInitGetUserMedia: function (error) {
			var msg;
			switch (error.code || error.name) {
				case 'PermissionDeniedError':
				case 'PERMISSION_DENIED':
				case 'NotAllowedError':
					msg = '用户拒绝访问麦克风';
					break;
				case 'NOT_SUPPORTED_ERROR':
				case 'NotSupportedError':
					msg = '浏览器不支持麦克风';
					break;
				case 'MANDATORY_UNSATISFIED_ERROR':
				case 'MandatoryUnsatisfiedError':
					msg = '找不到麦克风设备';
					break;
				default:
					msg = '无法打开麦克风，异常信息:' + (error.code || error.name);
					break;
			}
			alert(msg);
		}
	};


	//兼容require、amd
	if ("function" === typeof require && "object" === typeof module && module && module.id && "object" === typeof exports && exports) {
		module.exports = Record
	} else {
		if ("function" === typeof define && define.amd) {
			define("WebRecord", [],
				function () {
					return Record
				})
		}
	}

	exports.Record = Record;
})(window);
