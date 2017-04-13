var net = require('net');
var buf = require('buffer');
// var ibm866 = require('ibm866');

var CNP2Socket = function( socket ) {
	this._socket = socket;
	this._contentLength = null;
	this._rawBuffer = null;
	this._closed = false;
	this.PULSEBUFFER = new buf.Buffer( [ 255, 0, 0, 0 ] );
	this.ENCODING = 'binary';
	socket.on('data', this._onData.bind(this));
	socket.on('close', this._onClose.bind(this));
	socket.on('err', this._onError.bind(this));
};

module.exports = CNP2Socket;

CNP2Socket.prototype = {

	_onData: function( data ) {
		this._handleData( data );
	},
	_handleData: function( data ) {
		// Функция проверки буфера на наличие сообщения похожего на стр. CNP2
		// по признакам:
		// 1-байт принимает значения: 40 от сервера 50 от клиента
		// 2-байт принимает значение: 2 - версия протокола
		function validateCNP2( buffer ) {
			var type = buffer.readUInt8( 0 );
			var version = buffer.readUInt8( 1 );
			var isCNP2Struct = true;

			if ( type !== 40 && type !== 50 ) {
				isCNP2Struct = false;
			}

			if ( version !== 2 ) {
				isCNP2Struct = false;
			}

			// Если проверка не пройдена очищаем буфер от мусора
			if ( !isCNP2Struct) {
				return false;
			}

			return true;
		}

		// Проверка наличия объекта типа буфер
		var isBuf = Buffer.isBuffer( this._rawBuffer );

		// Создание нового объекта буфера или склейка буфера со свежими данными
		if ( !isBuf ) {
			var dataLength = data.length;
			this._rawBuffer = new buf.Buffer( dataLength );
			data.copy( this._rawBuffer );
		} else {
			this._rawBuffer = Buffer.concat( [this._rawBuffer, data] );
		}

		// Если в буфере нет заголовка, выйти из функции
		if ( this._rawBuffer.length < 4 ) {
			return;
		}

		// Если в буфере лежит сообщения типа "Пульс", обработать его и выйти из
		// функции
		if ( this._rawBuffer.length === 4 ) {
			return this._handlePulse( this._rawBuffer );
		}

		// Проверка буфера на наличие сообщения похожего на структуру CNP2
		if ( !validateCNP2( this._rawBuffer.slice( 0, 2 ) ) ) {
			this._contentLength = null;
			this._rawBuffer = null;
			return;
		}

		// Если длинна тельца не определена, попытаться её узнать
		if ( this._contentLength === null ) {

			// Вычленения размера тельца
			var rawContentLength = this._rawBuffer.readUInt16LE( 2 );
			this._contentLength = rawContentLength;

			// Если размер тельца не число, выдать ошибку и выйти из функции
			if ( isNaN( this._contentLength ) ) {
				this._contentLength = null;
				this._rawBuffer = null;

				var err = new Error('Invalid content length supplied (' +
					rawContentLength + ') in: ' + bufHeader);
				err.code = 'E_INVALID_CONTENT_LENGTH';
				throw err;
			}
		}

		var msg;
		var rest;
		var headerLength = 4;
		switch ( this._contentLength ) {
			// Если где то допущена ошибка выйти из функции
			case null:
				return;

			// Если длина тельца ноль, попытаемся разобрать на пульс
			case 0:
				msg = this._rawBuffer.slice( 0, headerLength );
				rest = this._rawBuffer.slice( headerLength );

				this._handlePulse( msg );
				this._onData( rest );
				break;

			default:
				//Всё после заголовка
				var msgBodyLength = this._rawBuffer.length - headerLength;

				if ( msgBodyLength === this._contentLength ) {
					this._handleMessage( this._rawBuffer );
				} else if ( msgBodyLength > this._contentLength ) {
					var msgLength = headerLength + this._contentLength;
					msg = this._rawBuffer.slice( 0, msgLength );
					rest = this._rawBuffer.slice( msgLength );

					this._handleMessage( msg );
					this._onData( rest );
				}
				break;
		}
	}
};

console.log( 'CNP2Socket hello' );
