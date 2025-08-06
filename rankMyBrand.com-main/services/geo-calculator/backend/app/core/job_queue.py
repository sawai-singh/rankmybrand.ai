"""
Enterprise-grade job queue system for batch processing.
Supports multiple backends (Redis, Database, In-Memory for development).
"""

import asyncio
import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobPriority(int, Enum):
    LOW = 1
    NORMAL = 5
    HIGH = 10
    CRITICAL = 20


@dataclass
class Job:
    """Job representation with all necessary metadata."""
    id: str
    type: str
    payload: Dict[Any, Any]
    status: JobStatus = JobStatus.PENDING
    priority: JobPriority = JobPriority.NORMAL
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[Any, Any]] = None
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 300
    metadata: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.id is None:
            self.id = str(uuid.uuid4())
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        data = asdict(self)
        # Convert datetime objects to ISO format
        for key in ['created_at', 'started_at', 'completed_at']:
            if data.get(key):
                data[key] = data[key].isoformat()
        # Convert enums to strings
        data['status'] = self.status.value
        data['priority'] = self.priority.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Job':
        """Create Job from dictionary."""
        # Convert ISO strings back to datetime
        for key in ['created_at', 'started_at', 'completed_at']:
            if data.get(key):
                data[key] = datetime.fromisoformat(data[key])
        # Convert status and priority back to enums
        data['status'] = JobStatus(data['status'])
        data['priority'] = JobPriority(data['priority'])
        return cls(**data)


class JobQueue(ABC):
    """Abstract base class for job queue implementations."""
    
    @abstractmethod
    async def enqueue(self, job: Job) -> str:
        """Add a job to the queue."""
        pass
    
    @abstractmethod
    async def dequeue(self, job_types: Optional[List[str]] = None) -> Optional[Job]:
        """Get the next job from the queue."""
        pass
    
    @abstractmethod
    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get a specific job by ID."""
        pass
    
    @abstractmethod
    async def update_job(self, job: Job) -> bool:
        """Update job status and data."""
        pass
    
    @abstractmethod
    async def get_jobs_by_status(self, status: JobStatus, limit: int = 100) -> List[Job]:
        """Get jobs with a specific status."""
        pass
    
    @abstractmethod
    async def cleanup_old_jobs(self, days: int = 7) -> int:
        """Remove completed jobs older than specified days."""
        pass


class InMemoryJobQueue(JobQueue):
    """In-memory implementation for development and testing."""
    
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._queue: List[str] = []
        self._lock = asyncio.Lock()
    
    async def enqueue(self, job: Job) -> str:
        async with self._lock:
            self._jobs[job.id] = job
            # Insert based on priority
            inserted = False
            for i, job_id in enumerate(self._queue):
                if self._jobs[job_id].priority < job.priority:
                    self._queue.insert(i, job.id)
                    inserted = True
                    break
            if not inserted:
                self._queue.append(job.id)
            logger.info(f"Job {job.id} enqueued with priority {job.priority}")
            return job.id
    
    async def dequeue(self, job_types: Optional[List[str]] = None) -> Optional[Job]:
        async with self._lock:
            for i, job_id in enumerate(self._queue):
                job = self._jobs.get(job_id)
                if job and job.status == JobStatus.PENDING:
                    if job_types is None or job.type in job_types:
                        job.status = JobStatus.PROCESSING
                        job.started_at = datetime.utcnow()
                        self._queue.pop(i)
                        return job
            return None
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)
    
    async def update_job(self, job: Job) -> bool:
        async with self._lock:
            if job.id in self._jobs:
                self._jobs[job.id] = job
                return True
            return False
    
    async def get_jobs_by_status(self, status: JobStatus, limit: int = 100) -> List[Job]:
        jobs = [job for job in self._jobs.values() if job.status == status]
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)[:limit]
    
    async def cleanup_old_jobs(self, days: int = 7) -> int:
        async with self._lock:
            cutoff = datetime.utcnow() - timedelta(days=days)
            old_job_ids = [
                job_id for job_id, job in self._jobs.items()
                if job.completed_at and job.completed_at < cutoff
            ]
            for job_id in old_job_ids:
                del self._jobs[job_id]
            return len(old_job_ids)


class DatabaseJobQueue(JobQueue):
    """Database-backed job queue for production use."""
    
    def __init__(self, db_session_factory):
        self.get_db = db_session_factory
    
    async def enqueue(self, job: Job) -> str:
        # Implementation would use SQLAlchemy models
        # This is a placeholder for the actual implementation
        raise NotImplementedError("Database queue implementation pending")


class JobProcessor:
    """Processes jobs from the queue with retry logic and monitoring."""
    
    def __init__(self, queue: JobQueue, handlers: Dict[str, Callable]):
        self.queue = queue
        self.handlers = handlers
        self._running = False
        self._tasks: List[asyncio.Task] = []
    
    async def start(self, num_workers: int = 4):
        """Start processing jobs with specified number of workers."""
        self._running = True
        logger.info(f"Starting job processor with {num_workers} workers")
        
        for i in range(num_workers):
            task = asyncio.create_task(self._worker(f"worker-{i}"))
            self._tasks.append(task)
    
    async def stop(self):
        """Stop all workers gracefully."""
        logger.info("Stopping job processor")
        self._running = False
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
    
    async def _worker(self, worker_id: str):
        """Worker coroutine that processes jobs."""
        logger.info(f"{worker_id} started")
        
        while self._running:
            try:
                # Get next job
                job = await self.queue.dequeue(list(self.handlers.keys()))
                
                if not job:
                    # No jobs available, wait a bit
                    await asyncio.sleep(1)
                    continue
                
                logger.info(f"{worker_id} processing job {job.id} of type {job.type}")
                
                # Process job with timeout
                try:
                    handler = self.handlers.get(job.type)
                    if not handler:
                        raise ValueError(f"No handler for job type: {job.type}")
                    
                    # Execute with timeout
                    result = await asyncio.wait_for(
                        handler(job),
                        timeout=job.timeout_seconds
                    )
                    
                    # Mark as completed
                    job.status = JobStatus.COMPLETED
                    job.completed_at = datetime.utcnow()
                    job.result = result
                    await self.queue.update_job(job)
                    
                    logger.info(f"{worker_id} completed job {job.id}")
                    
                except asyncio.TimeoutError:
                    await self._handle_job_failure(
                        job, f"Job timed out after {job.timeout_seconds} seconds"
                    )
                except Exception as e:
                    await self._handle_job_failure(job, str(e))
                    
            except Exception as e:
                logger.error(f"{worker_id} encountered error: {e}", exc_info=True)
                await asyncio.sleep(5)  # Back off on errors
    
    async def _handle_job_failure(self, job: Job, error_message: str):
        """Handle job failure with retry logic."""
        job.error = error_message
        job.retry_count += 1
        
        if job.retry_count < job.max_retries:
            # Retry with exponential backoff
            job.status = JobStatus.RETRYING
            retry_delay = 2 ** job.retry_count
            logger.warning(
                f"Job {job.id} failed, retrying in {retry_delay} seconds. "
                f"Attempt {job.retry_count}/{job.max_retries}. Error: {error_message}"
            )
            await asyncio.sleep(retry_delay)
            job.status = JobStatus.PENDING
        else:
            # Max retries exceeded
            job.status = JobStatus.FAILED
            job.completed_at = datetime.utcnow()
            logger.error(
                f"Job {job.id} failed after {job.retry_count} attempts. Error: {error_message}"
            )
        
        await self.queue.update_job(job)


# Factory function to create appropriate queue based on configuration
def create_job_queue(queue_type: str = "memory", **kwargs) -> JobQueue:
    """Create a job queue instance based on configuration."""
    if queue_type == "memory":
        return InMemoryJobQueue()
    elif queue_type == "database":
        return DatabaseJobQueue(kwargs.get("db_session_factory"))
    elif queue_type == "redis":
        # Could add Redis implementation here
        raise NotImplementedError("Redis queue not yet implemented")
    else:
        raise ValueError(f"Unknown queue type: {queue_type}")