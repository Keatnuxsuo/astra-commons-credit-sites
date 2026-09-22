"""Integration checks against the LOCAL synthetic database only. Never issues real credits."""
import json, urllib.request, urllib.error, concurrent.futures
BASE='http://localhost:5173'
ADMIN='__sites_local_auth=1'
def request(path,method='GET',data=None,cookie='',origin=BASE):
    h={'Origin':origin,'Content-Type':'application/json'}
    if cookie:h['Cookie']=cookie
    req=urllib.request.Request(BASE+path, data=json.dumps(data).encode() if data is not None else None, headers=h, method=method)
    try:r=urllib.request.urlopen(req,timeout=30)
    except urllib.error.HTTPError as e:r=e
    raw=r.read().decode();return r.status,json.loads(raw) if r.headers.get('Content-Type','').startswith('application/json') else raw,r.headers.get('Set-Cookie','').split(';')[0]
def check_in(i):
    status,data,cookie=request('/api/check-in','POST',{'name':f'  TEST  BUILDER {i}  ','email':f'  BUILDER{i}@EXAMPLE.TEST '})
    assert status==200,(status,data)
    return cookie
assert request('/api/organizer')[0]==403
assert request('/api/organizer/export')[0]==403
assert request('/api/organizer/receipt?id=test-1')[0]==403
status,state,_=request('/api/organizer',cookie=ADMIN)
assert status==200,(status,state)
assert len(state['guests'])==65
assert all(g['email'].endswith('@example.test') for g in state['guests']),'Refusing to test non-synthetic inventory'
reserved=[int(g['id'].split('-')[1]) for g in state['guests'] if not g['issued_at']]
assert len(reserved)>=2,'Need two unissued synthetic guests'
first,second=reserved[:2]
baseline=sum(bool(g['issued_at']) for g in state['guests'])
assert request('/api/organizer','POST',{'open':False},ADMIN)[0]==200
assert request('/api/status')[1]=={'open':False}
assert request('/api/check-in','POST',{'name':'Nobody Here','email':'missing@example.test'})[0]==404
assert request('/api/check-in','POST',{'name':'Someone','email':'not-an-email'})[0]==400
assert request('/api/check-in','POST',{'name':'Wrong Person','email':f'builder{first}@example.test'})[0]==404
assert request('/api/check-in','POST',{'name':'Someone','email':'some@example.test'},origin='https://elsewhere.example')[0]==403
assert request('/api/claim','POST',{})[0]==401
cookie=check_in(first)
assert request('/api/claim','POST',{},cookie)[0]==409
assert request('/api/session',cookie=cookie)[1]['rewards'] is None
assert request('/api/organizer','POST',{'open':True},ADMIN)[0]==200
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
    results=list(ex.map(lambda _:request('/api/claim','POST',{},cookie),range(12)))
assert all(r[0]==200 for r in results),[r[0] for r in results]
pairs=[r[1]['rewards'] for r in results]
assert all(p==pairs[0] for p in pairs)
assert pairs[0]['apiCode'].startswith('TEST')
other=check_in(second)
pair2=request('/api/claim','POST',{},other)[1]['rewards']
assert pairs[0]['apiCode']!=pair2['apiCode'] and pairs[0]['codexUrl']!=pair2['codexUrl']
assert request('/api/session',cookie=cookie)[1]['rewards']==pairs[0]
assert request('/api/check-in','POST',{'name':f'Test Builder {first}','email':f'builder{first}@example.test'})[1]['rewards']==pairs[0]
assert request('/api/organizer','POST',{'open':False},ADMIN)[0]==200
assert request('/api/claim','POST',{},cookie)[1]['rewards']==pairs[0]
summary=request('/api/organizer',cookie=ADMIN)[1]
assert sum(bool(g['issued_at']) for g in summary['guests'])==baseline+2
csv=request('/api/organizer/export',cookie=ADMIN)[1]
assert len(csv.splitlines())==66 and 'TEST000' not in csv and 'codex/p/' not in csv
assert request('/api/session','DELETE',cookie=cookie)[0]==200
assert request('/api/session',cookie=cookie)[1]['name'] is None
assert request('/api/claim','POST',{},cookie)[0]==401
for _ in range(9):rate=request('/api/check-in','POST',{'name':'No Match','email':'rate-limit@example.test'})
assert rate[0]==429
print('PASS: registration normalization/mismatch; anonymous admin denial; origin guard; paused claims; 12 concurrent retries; distinct allocations; recovery; session revocation; export privacy; rate limit.')
print('Synthetic pairs issued: 2. Real inventory untouched. Claims left paused.')
