require('ssdp');

Db = require('mongodb').Db;
Server = require('mongodb').Server;
Connection = require('mongodb').Connection;

UPNP = function UPNP() {
	this.ssdp = new SSDP();

	this.close = function () {
		this.ssdp.close();
	};

	this.time = function() {
		return Math.round(new Date().getTime() / 1000.00)
	}
};

UPNP.prototype.server = function server() {
	this.db = new Db('mediabrary', new Server('127.0.0.1',
		Connection.DEFAULT_PORT));

	this.ssdp.addUSN('upnp:rootdevice');
	this.ssdp.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
	this.ssdp.addUSN('urn:microsoft-com:service:X_MS_MediaReceiverRegistrar:1');
	this.ssdp.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1');
	this.ssdp.addUSN('urn:schemas-upnp-org:service:ConnectionManager:1');

	this.ssdp.on('advertise-alive', function (heads) {
		// Expire old devices.
		this.db.collection('device', function (err, col) {
			col.remove({'EXPIRE': { $gt: this.time() }});
		}.bind(this));

		interval = parseInt(heads['CACHE-CONTROL'].match(/\s*[^=]+=(.*)$/)[1]);
		heads['EXPIRE'] = this.time() + interval;
		this.db.collection('device', function (err, col) {
			col.update({usn: heads['USN']},
			{ '$set': heads}, { upsert: 1, safe: 1});
		});
	}.bind(this));

	this.ssdp.on('advertise-bye', function (heads) {
		this.db.collection('device', function (err, col) {
			col.remove({NT: heads['NT'], USN: heads['usn']});
		});
	}.bind(this));

	this.db.open(function dbOpen(err, con) {
		require('dns').lookup(require('os').hostname(), function (err, add) {
			this.ssdp.server(add);
		}.bind(this));
	}.bind(this));
}

exports.UPNP = UPNP;
