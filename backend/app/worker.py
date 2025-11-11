import os
import time
import json
import redis
from app.nlu.transcribe import transcribe_and_extract
from app.db import SessionLocal
from app.models import Expense, Installment
from datetime import datetime


REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
redis_client = redis.Redis.from_url(REDIS_URL)


def save_result_to_db(result: dict, user_id: int):
db = SessionLocal()
try:
exp = Expense(
user_id=user_id,
description=result.get('text'),
total_amount=result.get('total_amount'),
payment_method=result.get('payment_method'),
category=result.get('category')
)
db.add(exp)
db.commit()
db.refresh(exp)
for inst in result.get('installments', []):
ins = Installment(
expense_id=exp.id,
amount=inst.get('amount'),
due_date=inst.get('due_date'),
status=inst.get('status', 'pending'),
installment_number=inst.get('installment_number')
)
db.add(ins)
db.commit()
finally:
db.close()


def worker_loop():
print('Worker started, waiting for jobs...')
while True:
_, raw = redis_client.blpop('transcribe_queue')
job = json.loads(raw)
audio_path = job.get('audio_path')
user_id = job.get('user_id', 1)
try:
result = transcribe_and_extract(audio_path)
save_result_to_db(result, user_id)
except Exception as e:
print('Error processing job:', e)
time.sleep(0.1)


if __name__ == '__main__':
worker_loop()