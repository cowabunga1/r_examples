
/**
 * @brief Обработать остаток
 * @details Метод подготавливающий остаток к рекурсивному вызову функции первичной обработки сырых данных
 *
 * @param client Указатель на структуру клиента
 * @param __buf Указатель на структуру буфера для клиента
 * @param head_buf_size Размер обработанных данных (Голова)
 */
void CcpUvTcpServer::__handle_rest_data( uv_stream_t* client, uv_buf_t* __buf, size_t head_buf_size ) {
	// объявление буфера с остатком
	size_t		rest_buf_size	= __buf->len - head_buf_size;
	uv_buf_t	rest_buf;

	// заполнение буфера с остатком
	__alloc_buffer( nullptr, rest_buf_size, &rest_buf );
	memcpy( rest_buf.base, __buf->base + head_buf_size, rest_buf_size );

	// очищение основного буфера
	free( __buf->base );
	// объявление основного буфера
	__alloc_buffer( nullptr, rest_buf_size, __buf );
	// заполнение основного буфера
	memcpy( __buf->base, rest_buf.base, rest_buf_size );

	// очищение буфера с остатком
	free( rest_buf.base );

	_handle_data_r( client, 0, nullptr );
	return;
}

/**
 * @brief Обработать данные
 * @details Метод первичной обработки сырых данных из tcp stream
 *
 * @param client Указатель на структуру клиента
 * @param nread Количество байт прочитанных из tcp stream
 * @param buf Указатель на структуру буфера с данными
 */
void CcpUvTcpServer::_handle_data_r( uv_stream_t* client, ssize_t nread, const uv_buf_t* buf ) {
	uv_buf_t* __buf = __find_buf_by_client( client );	// Проверка наличия существующего буфера для клиента
	if ( __buf != nullptr ) {
		if ( nread > 0 && buf != nullptr ) {
			// Склейка буфера со свежими данными
			__concat_buf( __buf, buf, static_cast< size_t >( nread ) );
		}
		// Если входных данных нет, значит функция была вызвана рекурсивно и
		// обработается хвост сообщения, считается, что он был предварительно подрезан
	} else {
		if ( nread > 0 && buf != nullptr ) {
			// Создание нового буфера
			__buf = new uv_buf_t();												// создание буфера пустого буфера
			__add_to_buf_map( client, __buf );									// регистрация буфера
			__alloc_buffer( nullptr, static_cast< size_t >( nread ), __buf );	// выделение памяти под новый буфер
			memcpy( __buf->base, buf->base, static_cast< size_t >( nread ) );	// копирование данных
		} else {
			LOG_ERROR( "in buf is empty and no rest buf" );
			return;
		}
	}

	LOG_INPUT_2ARG( "buf_length", __buf->len );
	LOG_INPUT_2ARG( "buf_data", comcon::StringHelper::byte_2_str( __buf->base, __buf->len ) );

	if ( __buf->len < net::HEADER_SIZE ) {
		// Если в буфере нет заголовка, выйти из функции
		LOG_TRACE( "waiting for more data" );
		return;
	}

	// Создание указателя на заголовок
	net::UnifiedHeader_t* header = reinterpret_cast< net::UnifiedHeader_t* >( __buf->base );

	// Вычисление размеров
	size_t body_size	= header->size_data;						// размер тельца
	size_t total_size	= net::HEADER_SIZE + body_size;				// весь размер сообщения

	if ( body_size == 0 ) {
		// размер тела сообщения равен 0, что не предусмотрено в спецификации протокола
		if ( __buf->len > total_size ) {
			__handle_rest_data( client, __buf, total_size );		// если есть хвост, обработать его рекурсивно
			return;
		}

		__remove_from_buf_map( client );							// удалить буфер
		return;
	}

	// Если длина буфера меньше, чем общая длина сообщения выйти из функции
	if ( __buf->len < total_size ) {
		return;
	}

	// Обработка данных
	net::RawMessage_t *raw_msg = reinterpret_cast< net::RawMessage_t* >( __buf->base );
	__communicator->route_raw_msg( reinterpret_cast< void* >( client ), raw_msg );

	if ( __buf->len > total_size ) {
		__handle_rest_data( client, __buf, total_size );
		return;
	}

	__remove_from_buf_map( client );
	return;
}