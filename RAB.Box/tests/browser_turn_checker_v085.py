import json, os, shutil, subprocess, tempfile, pathlib, urllib.request, urllib.error, re
from playwright.sync_api import sync_playwright, expect

base = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path(tempfile.mkdtemp(prefix='magic-box-turn-checker-'))
for name in ['HOST.json','PATHS.json','package.json','mock-project','magic-box','language','runs','catalog','tools','engine','bridge']:
    source = base / name
    if source.is_dir(): shutil.copytree(source, root / name)
    elif source.exists(): shutil.copy2(source, root / name)

script = (
    f"import {{startServer}} from {json.dumps((base/'server.mjs').as_uri())};"
    f"const app=await startServer({{root:{json.dumps(str(root))},port:0,rabHome:{json.dumps(str(root/'.rab-test'))}}});"
    "console.log(app.origin);"
)
proc = subprocess.Popen(['node','--input-type=module','-e',script], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
origin = proc.stdout.readline().strip()
checks, errors = [], []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or p.chromium.executable_path,
            headless=True,
            args=['--no-sandbox'],
        )
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append('console: ' + message.text) if message.type == 'error' else None)

        def bridge(route, options):
            body = options.get('body')
            request = urllib.request.Request(
                origin + route,
                data=body.encode() if body is not None else None,
                headers=options.get('headers', {}),
                method=options.get('method', 'GET'),
            )
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    return {'status': response.status, 'data': json.loads(response.read())}
            except urllib.error.HTTPError as response:
                return {'status': response.code, 'data': json.loads(response.read())}

        page.expose_function('__hostApi', bridge)
        html = (base/'magic-box/index.html').read_text()
        script_text = re.search(r'<script>([\s\S]*?)</script>', html).group(1)
        html = re.sub(r'<script>[\s\S]*?</script>', '', html)
        client = script_text.replace('new URL(location.href)', 'new URL(window.__testURL)')
        async_boot = f'''window.__testURL={json.dumps(origin)};
window.history.replaceState=(unused,title,url)=>{{window.__testURL=String(url);}};
window.fetch=async(route,options={{}})=>{{const result=await window.__hostApi(route,options);return {{ok:result.status>=200&&result.status<300,status:result.status,json:async()=>result.data}};}};
'''
        page.set_content(html)
        page.add_script_tag(content=async_boot + client)
        expect(page.locator('#connection')).to_have_text('LOCAL · CONNECTED')

        page.locator('[data-view=turn-checker]').click()
        page.locator('#turn-check-input').fill('find fuck-off hooks')
        page.locator('#turn-check-form button[type=submit]').click()
        expect(page.locator('#turn-check-status')).to_have_text('BLOCKED')
        expect(page.locator('#turn-check-summary')).to_contain_text('typed-unknown')
        expect(page.locator('#turn-check-shape')).to_contain_text('operation')
        expect(page.locator('#turn-check-shape')).to_contain_text('find')
        expect(page.locator('#turn-check-shape')).to_contain_text('hook')
        expect(page.locator('#turn-check-shape')).to_contain_text('fuck-off')
        expect(page.locator('#turn-teach-panel')).to_have_count(0)
        first_check = json.loads(page.locator('#turn-check-json').text_content())
        assert first_check['scope'] == 'input-only'
        assert 'project' not in first_check
        checks.append('diagnostic output has no project or teaching controls')

        page.locator('#turn-check-input').fill('find state hooks')
        page.locator('#turn-check-form button[type=submit]').click()
        expect(page.locator('#turn-check-status')).to_have_text('CLEAR')
        expect(page.locator('#turn-check-shape')).to_contain_text('find-state-hooks')
        second_check = json.loads(page.locator('#turn-check-json').text_content())
        assert second_check['check_id'] != first_check['check_id']
        assert second_check['input'] == 'find state hooks'
        assert 'fuck-off' not in page.locator('#turn-check-shape').inner_text()
        checks.append('fresh input replaces the previous diagnostic output')

        page.screenshot(path=str(base/'verification/browser-turn-checker-input-only.png'), full_page=True)
        assert not errors, errors
        checks.append('Turn Checker UI produced no JavaScript errors')
        browser.close()

    result = {'browser': 'Playwright + real local API bridge', 'checks': checks, 'errors': errors}
    (base/'verification/browser-turn-checker-input-only.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
finally:
    proc.terminate()
    try: proc.wait(timeout=10)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(root, ignore_errors=True)
