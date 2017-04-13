

function multi_r( num ) {
	if ( num == 0 ) {
		return 1;
	}

	return num * multi_r( num - 1 );
}

function sum_r( num ) {
	if ( num == 0 ) {
		return 0;
	}

	return num + sum_r( num - 1 );
}

console.log( 'multi_r for 1: ' + multi_r( 1 ) );
console.log( 'multi_r for 2: ' + multi_r( 2 ) );
console.log( 'multi_r for 3: ' + multi_r( 3 ) );
console.log( 'multi_r for 4: ' + multi_r( 4 ) );
console.log( 'multi_r for 5: ' + multi_r( 5 ) );

console.log( 'sum_r for 1: ' + sum_r( 1 ) );
console.log( 'sum_r for 2: ' + sum_r( 2 ) );
console.log( 'sum_r for 3: ' + sum_r( 3 ) );
console.log( 'sum_r for 4: ' + sum_r( 4 ) );
console.log( 'sum_r for 5: ' + sum_r( 5 ) );
