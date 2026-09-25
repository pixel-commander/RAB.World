import json, os, shutil, subprocess, tempfile, pathlib, urllib.request, urllib.error, re
from playwright.sync_api import sync_playwright, expect

base=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path(tempfile.mkdtemp(prefix='magic-box-browser-'))
for name in ['HOST.json','PATHS.json','package.json','mock-project','magic-box','language','runs','catalog','tools','engine','bridge']:
    p=base/name
    if p.is_dir(): shutil.copytree(p,root/name)
    else: shutil.copy2(p,root/name)

script=(
    f"import {{startServer}} from {json.dumps((base/'server.mjs').as_uri())};"
    f"const app=await startServer({{root:{json.dumps(str(root))},port:0,rabHome:{json.dumps(str(root/'.rab-test'))}}});"
    "console.log(app.origin);"
)
proc=subprocess.Popen(['node','--input-type=module','-e',script],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
origin=proc.stdout.readline().strip()
print('ORIGIN',origin,flush=True)
errors=[]; checks=[]

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or p.chromium.executable_path,
            headless=True,args=['--no-sandbox']
        )
        page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append('console: '+m.text) if m.type=='error' else None)

        def bridge(route, options):
            assert route.startswith('/api/')
            body=options.get('body')
            request=urllib.request.Request(
                origin+route,
                data=body.encode() if body is not None else None,
                headers=options.get('headers',{}),
                method=options.get('method','GET')
            )
            try:
                with urllib.request.urlopen(request,timeout=30) as response:
                    return {'status':response.status,'data':json.loads(response.read())}
            except urllib.error.HTTPError as response:
                return {'status':response.code,'data':json.loads(response.read())}

        page.expose_function('__hostApi',bridge)
        html=(base/'magic-box/index.html').read_text()
        script_text=re.search(r'<script>([\s\S]*?)</script>',html).group(1)
        html=re.sub(r'<script>[\s\S]*?</script>','',html)
        client=script_text.replace('new URL(location.href)','new URL(window.__testURL)')
        async_boot=("""window.__testURL=%s;
window.history.replaceState=(unused,title,url)=>{window.__testURL=String(url);};
window.fetch=async(route,options={})=>{const result=await window.__hostApi(route,options);return {ok:result.status>=200&&result.status<300,status:result.status,json:async()=>result.data};};
""" % json.dumps(origin))
        page.set_content(html)
        page.add_script_tag(content=async_boot+client)
        expect(page.locator('#connection')).to_have_text('LOCAL · CONNECTED')
        expect(page.locator('[data-view=chat]')).to_have_attribute('aria-current','page')
        checks.append('v0.9.0 boots into the preserved Chat surface against the real local API')
        page.locator('#chat-input').fill('make a component')
        page.wait_for_timeout(350)
        expect(page.locator('#chat-tool-candidates')).to_contain_text('stamp-new-component')
        checks.append('live Finder narrows reworded Chat input against tools/**/settings.json while typing')
        page.locator('#chat-input').fill('audit folder x')
        page.wait_for_timeout(350)
        expect(page.locator('#chat-tool-candidates')).to_contain_text('look/read only')
        assert 'stamp-new-project' not in page.locator('#chat-tool-candidates').inner_text()
        checks.append('audit look/read cue hard-filters stamp-* candidates and other domains before ranking')
        page.locator('#chat-input').fill('')
        page.locator('[data-view=workbench]').click()
        expect(page.locator('#bag-strip')).to_contain_text('Bag')
        expect(page.locator('#tools-list')).to_contain_text('re-phrase-check')
        expect(page.locator('#tools-list')).to_contain_text('stamp-new-project')
        checks.append('recursive tools/ registry is visible beside the preserved Workbench')
        page.locator('#tool-select').select_option('base/stamp-new-project')
        expect(page.locator('#tool-fields')).to_contain_text('Project Type')
        expect(page.locator('#tool-fields')).to_contain_text('Project Name')
        expect(page.locator('#tool-fields')).to_contain_text('Parent Folder')
        checks.append('Tool runner builds its form directly from the selected Tool settings.json')
        page.locator('#tool-select').select_option('base/stamp-new-stamp')
        expect(page.locator('#tool-fields')).to_contain_text('Run Settings')
        expect(page.locator('#tool-fields')).to_contain_text('+ Add input field')
        page.locator('#tool-fields button',has_text='+ Add input field').click()
        expect(page.locator('#tool-fields')).to_contain_text('Type-specific options')
        checks.append('settings-type fields provide a self-similar field builder instead of requiring raw form-schema JSON')
        page.locator('#new-session').click()
        expect(page.locator('#activity')).to_have_text('Ready.')

        def send_turn(text):
            page.locator('#request-text').fill(text)
            page.locator('#prepare').click()

        # One Turn -> multiple nested Steps.
        send_turn('add component TestOne then add component to it called Menu')
        expect(page.locator('#plan-status')).to_have_text('READY')
        expect(page.locator('#plan-body')).to_contain_text('new-component')
        expect(page.locator('#plan-body')).to_contain_text('sub-component')
        expect(page.locator('#bag-strip')).to_contain_text('TestOne → Menu')
        checks.append('one Turn compiles into nested new-component/sub-component Steps and updates the address stack')
        page.locator('[data-view=chat]').click()
        expect(page.locator('#chat-session-execute')).to_be_visible()
        expect(page.locator('#chat-session-execute')).to_be_enabled()
        checks.append('Chat itself exposes confirm/YOLO for a resolved group instead of bouncing the operator back to Workbench')
        page.locator('[data-view=workbench]').click()

        # New Turn branches back to a known parent and nests again.
        send_turn('now add component to TestOne called SideBar then add component to SideBar called BootBar')
        expect(page.locator('#plan-status')).to_have_text('READY')
        expect(page.locator('#plan-body')).to_contain_text('SideBar')
        expect(page.locator('#plan-body')).to_contain_text('BootBar')
        expect(page.locator('#bag-strip')).to_contain_text('TestOne → SideBar → BootBar')
        checks.append('next Turn reuses known parents, branches back to TestOne, and nests BootBar under SideBar')

        # Unqualified new top-level component starts a new group while project context persists.
        send_turn('add new component Card')
        expect(page.locator('#plan-status')).to_have_text('READY')
        expect(page.locator('#plan-body')).to_contain_text('GROUP-2')
        expect(page.locator('#bag-strip')).to_contain_text('current: Card')
        checks.append('new top-level component starts a new group without losing higher project context')

        # Strict language failure: no spell correction / no guessed execution.
        send_turn('nd thwies willll sete tehm all fof')
        expect(page.locator('#plan-status')).to_contain_text('GAP')
        expect(page.locator('#plan-body')).to_contain_text('language:')
        checks.append('strict typo soup becomes visible language gaps instead of guessed meaning')

        # Fresh audit session: audit is a mode; ordinary read Tools use the loaded project by default.
        page.locator('#new-session').click()
        send_turn('audit all state hooks')
        expect(page.locator('#plan-status')).to_have_text('READY')
        expect(page.locator('#plan-body')).to_contain_text('find-state-hooks')
        send_turn('now find effect hooks')
        expect(page.locator('#plan-status')).to_have_text('READY')
        expect(page.locator('#plan-body')).to_contain_text('find-use-effect')
        checks.append('audit mode resolves ordinary read Tools and reuses the loaded project without a legacy audit workspace ceremony')

        # Decoder override is a separate operator-reviewed lexical layer.
        page.locator('[data-view=language]').click()
        page.locator('#type-lemma').fill('widget')
        page.locator('#type-forms').fill('widget, widgets')
        page.locator('#type-types').fill('noun')
        page.locator('#type-senses').fill('component')
        page.locator('#type-form button[type=submit]').click()
        expect(page.locator('#type-status')).to_contain_text('Saved and reloaded live')
        expect(page.locator('#type-json')).to_contain_text('widget')
        checks.append('operator can add lexical candidates without hard-mapping words directly to seats')

        # Existing offline language lab still works.
        expect(page.locator('#grammar-text')).to_contain_text('NP[KIND=?k')
        page.locator('#word-query').fill('build')
        page.locator('#word-form button').click()
        expect(page.locator('#word-results .sense')).to_have_count(2)
        checks.append('existing offline grammar/resource lab remains available beside the v0.8 tool-house refactor')

        # Re-phrase is a dedicated chat-like Tool surface, not a second general chat.
        page.locator('[data-view=rephrase]').click()
        page.locator('#rephrase-input').fill('re-phrase "this didn\'t work"')
        page.locator('#rephrase-send').click()
        expect(page.locator('#rephrase-messages')).to_contain_text('This failed.')
        expect(page.locator('#rephrase-logic')).to_contain_text('succeed')
        expect(page.locator('#rephrase-logic')).to_contain_text('negated-predicate')
        checks.append('Re-phrase tab runs only base/re-phrase-check and exposes lexical/sense logic')
        page.screenshot(path=str(base/'verification/browser-rephrase-v0.8.png'),full_page=True)

        # Legacy deterministic runtime remains connected for comparison/execution.
        page.locator('[data-view=workbench]').click()
        page.locator('#form-mode').click()
        page.locator('#stamp-select').select_option('component-stamp')
        expect(page.locator('#manual-fields')).to_contain_text('class')
        page.locator('#manual-fields input[name=name]').fill('ManualWidget')
        page.locator('#manual-fields input[name=class]').fill('container-main')
        page.locator('#manual-form button[type=submit]').click()
        expect(page.locator('#run-status')).to_have_text('READY')
        checks.append('legacy settings-generated deterministic stamp path is still intact')

        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(base/'verification/browser-mobile-v0.8.png'),full_page=True)
        overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not overflow, f'mobile horizontal overflow: {page.evaluate("document.documentElement.scrollWidth")}px'
        checks.append('390px viewport has no horizontal overflow')

        page.set_viewport_size({'width':1440,'height':1100})
        page.screenshot(path=str(base/'verification/browser-workbench-v0.8.png'),full_page=True)
        assert not errors, errors
        checks.append('no JavaScript errors in the v0.9.0 DOM interaction harness')
        browser.close()

    result={
        'browser':'Playwright with system Chromium; managed navigation is bypassed with a virtual URL and Python bridge to the real local HTTP API. Direct navigation/CSP is not covered by this harness.',
        'checks':checks,'errors':errors
    }
    (base/'verification/browser-test-v0.8.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2),flush=True)
finally:
    proc.terminate(); proc.wait(timeout=10)
    shutil.rmtree(root)
