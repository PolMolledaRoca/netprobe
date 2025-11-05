const { EventEmitter } = require('events');

class JobQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxParallelJobs = options.maxParallelJobs || 2;
    this.queue = [];
    this.active = new Map();
  }

  // Agrega un trabajo a la cola y dispara su ejecución según la disponibilidad
  enqueue(job) {
    if (!job || typeof job.run !== 'function' || !job.id) {
      throw new Error('Job inválido: requiere id y función run');
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.emit('queued', { id: job.id });
      this._process();
    });
  }

  // Cancela un trabajo activo o en espera
  cancel(jobId) {
    if (!jobId) return false;

    const activeJob = this.active.get(jobId);
    if (activeJob) {
      if (typeof activeJob.job.cancel === 'function') {
        activeJob.job.cancel();
      }
      activeJob.reject(new Error('Trabajo cancelado'));
      this.active.delete(jobId);
      this.emit('cancelled', { id: jobId, status: 'active' });
      this._process();
      return true;
    }

    const queueIndex = this.queue.findIndex(({ job }) => job.id === jobId);
    if (queueIndex >= 0) {
      const [{ reject }] = this.queue.splice(queueIndex, 1);
      reject(new Error('Trabajo cancelado'));
      this.emit('cancelled', { id: jobId, status: 'queued' });
      return true;
    }

    return false;
  }

  _process() {
    if (this.active.size >= this.maxParallelJobs) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    const { job, resolve, reject } = next;
    this.active.set(job.id, { job, resolve, reject });
    this.emit('started', { id: job.id });

    Promise.resolve()
      .then(() => job.run())
      .then((result) => {
        this.active.delete(job.id);
        resolve(result);
        this.emit('completed', { id: job.id });
        this._process();
      })
      .catch((error) => {
        this.active.delete(job.id);
        reject(error);
        this.emit('failed', { id: job.id, error });
        this._process();
      });
  }
}

module.exports = {
  JobQueue,
};
