# 杞绘枃 LWD

[![build](https://github.com/lq23256566678lj/qingwen-lwd/actions/workflows/build.yml/badge.svg)](https://github.com/lq23256566678lj/qingwen-lwd/actions/workflows/build.yml)

> 鍐欎綔锛屽簲璇ヨ交涓€鐐广€?
杞绘枃鏄竴娆惧熀浜?**Tauri 2 + Rust + React + TipTap 3** 鐨勮法骞冲彴杞婚噺绾у瘜鏂囨湰缂栬緫鍣ㄣ€傚畠鎶?Word 閲屾渶甯哥敤鐨勯偅閮ㄥ垎鑳藉姏鍋氬緱瓒冲椤烘墜锛屽悓鏃剁敤涓€涓嚜鍖呭惈鐨?`.lwd` JSON 鏂囦欢淇濆瓨鍏ㄩ儴鍐呭锛氭枃瀛椼€佹牸寮忋€佽〃鏍煎拰鍥剧墖閮藉湪涓€涓枃浠堕噷锛屼笉渚濊禆 Office锛屼篃涓嶄緷璧栬祫婧愮洰褰曘€?
<p align="center"><img src="assets/icon-source.png" width="120" alt="杞绘枃鍥炬爣" /></p>

## 涓嬭浇

宸插彂甯?**v0.1.0**锛歔GitHub Releases](https://github.com/lq23256566678lj/qingwen-lwd/releases/tag/v0.1.0)

| 骞冲彴 | 瀹夎鍖?|
| --- | --- |
| Windows x64 | [瀹夎鐗堬紙NSIS锛塢(https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD_0.1.0_x64-setup.exe) 路 [MSI](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD_0.1.0_x64_en-US.msi) 路 [渚挎惡鐗?ZIP](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen-LWD-0.1.0-Windows-x64-portable.zip) |
| macOS Universal | [DMG](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD_0.1.0_universal.dmg) |
| Linux x64 | [AppImage](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD_0.1.0_amd64.AppImage) 路 [DEB](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD_0.1.0_amd64.deb) 路 [RPM](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.1.0/Qingwen.LWD-0.1.0-1.x86_64.rpm) |

瀹夎鍖呯敱 GitHub Actions 鍦?Windows/macOS/Linux 涓婃瀯寤猴紝鍧囨湭浠ｇ爜绛惧悕锛沇indows SmartScreen 涓?macOS Gatekeeper 鍙兘鎻愮ず锛岄渶鎵嬪姩鍏佽銆?
## 鍔熻兘涓€瑙?
| 鍒嗙被 | 鑳藉姏 |
| --- | --- |
| 鏂囦欢 | 鏂板缓銆佹墦寮€銆佷繚瀛樸€佸彟瀛樹负銆佹嫋鍏?`.lwd` 鎵撳紑銆佸鍑?UTF-8 绾枃鏈?/ 鐙珛 HTML |
| 瀛楃鏍煎紡 | 鍔犵矖銆佹枩浣撱€佷笅鍒掔嚎銆佸垹闄ょ嚎銆佸瓧浣撱€佸瓧鍙枫€佸瓧浣撻鑹层€侀珮浜€佽鍐呬唬鐮併€佹竻闄ゆ牸寮?|
| 娈佃惤鏍煎紡 | 姝ｆ枃銆佹爣棰?1鈥?銆佸乏/涓?鍙?涓ょ瀵归綈銆侀」鐩鍙枫€佺紪鍙峰垪琛ㄣ€佸紩鐢ㄣ€佷唬鐮佸潡銆佸垎闅旂嚎 |
| 琛ㄦ牸 | 6脳6 缃戞牸鎻掑叆銆佸鍒犺/鍒椼€佸悎骞?鎷嗗垎鍗曞厓鏍笺€佸垏鎹㈣〃澶磋銆佸垹闄よ〃鏍笺€佹嫋鎷借皟鏁村垪瀹?|
| 鍥剧墖 | 宸ュ叿鏍忔彃鍏ャ€佸壀璐存澘绮樿创銆佹嫋鍏ョ獥鍙ｃ€佹嫋鎷界缉鏀俱€乨ata URL 鍐呭祵銆佽嚜鍔ㄥ帇缂?|
| 鏌ユ壘鏇挎崲 | 鍏ㄦ枃鏌ユ壘銆佷笂涓€涓?涓嬩竴涓€佸尯鍒嗗ぇ灏忓啓銆佸崟鏉℃浛鎹€佸叏閮ㄦ浛鎹€佸懡涓鏁?|
| 鏂囨。 | 瀛楁暟/瀛楃缁熻銆佹湭淇濆瓨鐘舵€併€佽嚜鍔ㄤ繚瀛樸€佸穿婧冩仮澶嶈崏绋裤€佸叧闂墠淇濆瓨鎻愰啋 |
| 骞冲彴 | Windows / macOS / Linux 鍘熺敓鑿滃崟锛屸寴 / Ctrl 蹇嵎閿嚜鍔ㄩ€傞厤锛屼腑鏂囪緭鍏ユ硶鍙嬪ソ |

## 椤圭洰缁撴瀯

```text
qingwen/
鈹溾攢 index.html                     # Vite 鍏ュ彛
鈹溾攢 package.json                   # 鍓嶇渚濊禆涓庤剼鏈?鈹溾攢 pnpm-workspace.yaml            # pnpm hoisted 甯冨眬 + 鏋勫缓鑴氭湰鐧藉悕鍗?鈹溾攢 tsconfig.json
鈹溾攢 vite.config.ts
鈹溾攢 assets/
鈹? 鈹溾攢 icon-source.png            # 1024脳1024 搴旂敤鍥炬爣婧愭枃浠?鈹? 鈹斺攢 sample-image.png            # 绀轰緥鏂囨。鍐呭祵鍥剧墖
鈹溾攢 docs/
鈹? 鈹溾攢 lwd-format.md               # .lwd 鏍煎紡璇存槑锛堜俊灏併€佽妭鐐广€佺増鏈€佽崏绋匡級
鈹? 鈹溾攢 lwd-format.schema.json      # JSON Schema锛堜俊灏?+ 瀹芥澗鏂囨。缁撴瀯锛?鈹? 鈹斺攢 limitations.md              # 宸茬煡闄愬埗
鈹溾攢 examples/
鈹? 鈹斺攢 welcome.lwd                 # 鍙洿鎺ユ墦寮€鐨勭ず渚嬫枃妗ｏ紙鍚〃鏍?鍥剧墖/浠ｇ爜鍧楋級
鈹溾攢 scripts/
鈹? 鈹斺攢 validate-lwd.mjs            # 鐢ㄧ紪杈戝櫒鍚屾 schema 鏍￠獙 .lwd
鈹溾攢 src/
鈹? 鈹溾攢 main.tsx
鈹? 鈹溾攢 App.tsx                     # 鏂囨。浼氳瘽銆佽嚜鍔ㄤ繚瀛樸€佽彍鍗?蹇嵎閿€佹湭淇濆瓨瀹堝崼
鈹? 鈹溾攢 components/
鈹? 鈹? 鈹溾攢 TopBar.tsx               # 鏂囦欢鏍忋€佷繚瀛樼姸鎬併€佸鍑?鈹? 鈹? 鈹溾攢 Toolbar.tsx              # Word 椋庢牸宸ュ叿鏍忋€侀鑹查潰鏉裤€佽〃鏍煎伐鍏?鈹? 鈹? 鈹溾攢 FindReplace.tsx          # 鏌ユ壘鏇挎崲娴眰
鈹? 鈹? 鈹溾攢 StatusBar.tsx            # 瀛楁暟銆佷繚瀛樼姸鎬?鈹? 鈹? 鈹溾攢 RecoveryBanner.tsx       # 宕╂簝鎭㈠鎻愮ず
鈹? 鈹? 鈹溾攢 Modal.tsx                # 鐒︾偣鍦堝畾 + Esc 鍏抽棴鐨勬ā鎬佹
鈹? 鈹? 鈹溾攢 ConfirmDialog.tsx        # 淇濆瓨 / 鏀惧純 / 鍙栨秷
鈹? 鈹? 鈹溾攢 LinkDialog.tsx
鈹? 鈹? 鈹溾攢 AboutDialog.tsx
鈹? 鈹? 鈹溾攢 ShortcutsDialog.tsx
鈹? 鈹? 鈹溾攢 Toasts.tsx
鈹? 鈹? 鈹斺攢 ui.tsx                   # ToolButton / Popover / Kbd / Spinner
鈹? 鈹溾攢 editor/
鈹? 鈹? 鈹溾攢 extensions.ts            # TipTap 鎵╁睍瑁呴厤銆佸瓧浣?瀛楀彿棰勮
鈹? 鈹? 鈹斺攢 SearchHighlight.ts       # ProseMirror 鎼滅储瑁呴グ鎻掍欢
鈹? 鈹溾攢 lib/
鈹? 鈹? 鈹溾攢 api.ts                   # 瀵?Tauri invoke 鐨勮杽灏佽
鈹? 鈹? 鈹溾攢 types.ts                 # 鍓嶅悗绔叡浜殑 TS 绫诲瀷
鈹? 鈹? 鈹溾攢 text.ts                  # 瀛楁暟缁熻銆佽矾寰勫鐞嗐€丠TML 瀵煎嚭妯℃澘
鈹? 鈹? 鈹溾攢 image.ts                 # data URL 鍘嬬缉涓庡壀璐存澘鍥剧墖
鈹? 鈹? 鈹斺攢 platform.ts              # IS_MAC / IS_TAURI / 蹇嵎閿枃妗?鈹? 鈹斺攢 styles/
鈹?    鈹溾攢 app.css                  # 搴旂敤澶栧３銆佸伐鍏锋爮銆佸脊灞傘€佸脊绐?鈹?    鈹斺攢 editor.css               # 鏂囨。鎺掔増銆佽〃鏍笺€佸浘鐗囩缉鏀俱€佹悳绱㈤珮浜?鈹斺攢 src-tauri/
   鈹溾攢 Cargo.toml
   鈹溾攢 build.rs
   鈹溾攢 tauri.conf.json             # 绐楀彛銆丆SP銆佹墦鍖呴厤缃?   鈹溾攢 capabilities/default.json   # 鏈€灏忔潈闄愶細dialog + window 鍩虹鎿嶄綔
   鈹溾攢 icons/                      # 鍚勫钩鍙板浘鏍?   鈹斺攢 src/
      鈹溾攢 main.rs
      鈹溾攢 lib.rs                   # 鍛戒护娉ㄥ唽銆佽彍鍗曚簨浠惰浆鍙?      鈹溾攢 menu.rs                  # 鍘熺敓鑿滃崟涓庡钩鍙板揩鎹烽敭
      鈹斺攢 storage.rs               # .lwd / 鑽夌 / 鍥剧墖 / 瀵煎嚭鐨勫師瀛愯鍐欎笌鏍￠獙
```

## 鎶€鏈€夊瀷涓庣悊鐢?
### Tauri 2 + Rust锛岃€屼笉鏄?Electron

- 瀹夎鍖呴€氬父鍙湁鍑?MB 鍒板崄鍑?MB锛屽唴瀛樺崰鐢ㄦ槑鏄句綆浜?Electron锛涘鈥滆交閲忕骇缂栬緫鍣ㄢ€濊繖涓畾浣嶅緢閲嶈銆?- 澶嶇敤绯荤粺 WebView锛歐indows 鐢?WebView2锛宮acOS 鐢?WKWebView锛孡inux 鐢?WebKitGTK銆?- Rust 璐熻矗鏂囦欢绯荤粺銆佹牸寮忔牎楠屻€佸師瀛愬啓鍏ャ€佸浘鐗囧鍏ュ拰鍘熺敓鑿滃崟锛涘墠绔笉鐩存帴鎷块€氱敤鏂囦欢绯荤粺鏉冮檺锛屾敾鍑婚潰鏇村皬銆?- 浠ｄ环鏄笁涓钩鍙?WebView 鐨勬帓鐗堜笌杈撳叆娉曡涓哄瓨鍦ㄥ樊寮傦紝闇€瑕侀€愬钩鍙板洖褰掞紙瑙佲€滃凡鐭ラ檺鍒垛€濓級銆?
### TipTap 3锛圥roseMirror锛夛紝鑰屼笉鏄嚜鐮?contenteditable / Quill / Slate

- **JSON 鍘熺敓**锛歍ipTap 鐨勬枃妗ｆā鍨嬪氨鏄?ProseMirror JSON锛屽彲浠ョ洿鎺ヤ綔涓?`.lwd` 鐨?`document` 瀛楁锛屾棤闇€鍐嶅仛涓€灞傛牸寮忚浆鎹€?- **Schema 鏍￠獙**锛氭墦寮€鏂囦欢鏃跺彲浠ユ嫆缁濋潪娉曡妭鐐癸紝鑰屼笉鏄妸鏈煡鍐呭闈欓粯涓㈡帀锛涜繖姣斺€滄妸 HTML 濉炶繘 contenteditable鈥濆彲闈犲緱澶氥€?- **涓枃杈撳叆娉?*锛歅roseMirror 瀵?composition 浜嬩欢鐨勫鐞嗘垚鐔燂紝缂栬緫鍣ㄤ笉闇€瑕佽嚜宸辨帴绠?`keydown` 鎻掑叆鏂囧瓧锛涢厤鍚堚€滅粍鍚堣緭鍏ユ湡闂翠笉瑙﹀彂鍏ㄥ眬蹇嵎閿€濆嵆鍙伩鍏嶇粷澶у鏁颁腑鏂囪緭鍏ラ棶棰樸€?- **琛ㄦ牸涓庡浘鐗?*锛氬畼鏂规墿灞曡鐩栧悎骞跺崟鍏冩牸銆佸垪瀹芥嫋鎷姐€佸浘鐗囩缉鏀撅紱杩欎簺鍔熻兘濡傛灉鑷爺锛屽伐浣滈噺浼氳繀閫熻秴杩囨暣涓」鐩€?- **Headless**锛歍ipTap 涓嶅甫 UI锛屾墠鑳藉仛鍑虹揣鍑戠殑 Word 椋庢牸宸ュ叿鏍忥紝鑰屼笉鏄涓€涓€氱敤瀵屾枃鏈毊鑲ゃ€?- 瀵规瘮锛歀exical 鎬ц兘寰堝ソ锛屼絾琛ㄦ牸/鍥剧墖/IME 鐢熸€侀渶瑕佹洿澶氳嚜鐮旓紱Slate 鏇寸伒娲讳絾 schema 涓庤〃鏍艰鑷繁瀹氫箟锛決uill 鐨?Delta 妯″瀷涓庣洰鏍?JSON 缁撴瀯涓嶅尮閰嶏紝澶嶆潅琛ㄦ牸鑳藉姏寮便€?
### React 19 + Vite 8 + 鎵嬪啓 CSS

- Vite 鎻愪緵蹇€?HMR 鍜岀畝鍗曠殑 Tauri 鍓嶇闆嗘垚銆?- 涓嶅紩鍏ョ粍浠跺簱锛屽伐鍏锋爮瀵嗗害銆侀鑹层€佺劍鐐硅涓哄拰 Word 鐨勮鎰熷彲浠ョ簿纭帶鍒讹紝涔熷噺灏戜緷璧栦綋绉€?- 鍥炬爣浣跨敤 tree-shake 鐨?`lucide-react`锛汣SS 鍙湁涓や釜鏂囦欢锛屼究浜庡鏌ヤ笌鏇挎崲涓婚銆?
### Rust 鍚庣杈圭晫

鍓嶇鍙€氳繃浠ヤ笅鍛戒护璁块棶绯荤粺锛?
- `read_document` / `save_document`
- `save_draft` / `load_draft` / `clear_draft`
- `read_image_as_data_url`
- `export_document`
- `quit_app`

娌℃湁鍚敤 `tauri-plugin-fs`锛屼篃娌℃湁鎶婁换鎰忚矾寰勮鍐欐毚闇茬粰 WebView銆傛枃浠惰矾寰勫繀椤讳负缁濆璺緞锛屾墿灞曞悕鍜屾枃浠跺ご閮戒細鏍￠獙銆?
### 涓轰粈涔堟槸 `.lwd`锛屼笉鏄?docx

闇€姹傛槑纭姹傝嚜瀹氫箟 JSON 鏍煎紡銆傚疄鐜颁笂鎶?`.lwd` 璁捐鎴愨€滀俊灏?+ ProseMirror 鏂囨。 + 鍏冧俊鎭€濓紝鑰屼笉鏄洿鎺ュ瓨涓€涓８ doc锛氳繖鏍风増鏈縼绉汇€佹爣棰樸€佹椂闂存埑銆佸瓧鏁扮粺璁℃湁绋冲畾鐨勮惤鐐癸紝鏈潵鏂板瀛楁涔熶笉浼氭薄鏌?`document`銆?
## 蹇€熷紑濮?
### 鐜瑕佹眰

- **Rust 1.90+**锛圱auri 2.12 鐨?MSRV锛?- **Node.js 20.19+ / 22.12+**锛圴ite 8 瑕佹眰锛?- pnpm 11+锛堟垨 npm锛?- **Windows**锛歏isual Studio Build Tools锛圕++ 妗岄潰寮€鍙戯級+ Windows SDK + WebView2 Runtime锛圵in10/11 閫氬父鑷甫锛?- **macOS**锛歑code Command Line Tools
- **Linux**锛圖ebian/Ubuntu 绯伙級锛?
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### 瀹夎涓庡紑鍙?
```bash
pnpm install
pnpm tauri dev
```

濡傛灉浣跨敤 npm锛?
```bash
npm install
npm run tauri dev
```

> 浠撳簱涓殑 `pnpm-workspace.yaml` 鍥哄畾浜?`nodeLinker: hoisted`锛岀敤浜庨伩鍏?Windows 涓?pnpm 绗﹀彿閾炬帴涓?Node ESM 瑙ｆ瀽鐨勫吋瀹归棶棰橈紱浣跨敤 npm 鐨勭敤鎴峰彲浠ュ拷鐣ヨ鏂囦欢銆?
### 鏋勫缓

```bash
# 鏂瑰紡涓€锛欽S 鐗?Tauri CLI锛堟帹鑽愶紝闅忛」鐩緷璧栧畨瑁咃級
pnpm tauri build

# 鏂瑰紡浜岋細Cargo 鐗?Tauri CLI锛屾弧瓒?cargo tauri build 鐨勪氦浠樿姹?cargo install tauri-cli --version "^2" --locked
cargo tauri build
```

`cargo tauri build` 浼氭墽琛?`tauri.conf.json` 涓殑 `beforeBuildCommand`锛坄npm run build`锛夛紝鍥犳璇峰厛瀹夎鍓嶇渚濊禆锛屽苟纭繚 `npm` 鍦?PATH 涓€?
- 鍙獙璇佺紪璇戙€佷笉鎵撳畨瑁呭寘锛歚cargo tauri build --no-bundle`
- Windows 鍙墦 NSIS锛歚cargo tauri build --bundles nsis`
- 棣栨鎵撳寘 MSI/NSIS 鏃?Tauri 浼氫笅杞?WiX/NSIS 宸ュ叿锛岄渶瑕佺綉缁溿€?
### 鍓嶇鐙珛鏋勫缓涓庢牎楠?
```bash
pnpm build
node scripts/validate-lwd.mjs examples/welcome.lwd
# 鎴?pnpm validate:lwd
```

### 鏋勫缓楠岃瘉鐘舵€?
| 妫€鏌?| 缁撴灉 |
| --- | --- |
| `tsc --noEmit` | 閫氳繃 |
| Vite 8 鐢熶骇鏋勫缓锛?131 涓ā鍧楋級 | 閫氳繃锛屼骇鐗╃害 767 KB锛坓zip 239 KB锛?|
| `cargo fmt --check` | 閫氳繃 |
| `cargo check --target x86_64-pc-windows-gnu` | 閫氳繃锛圱auri 2.12.5 鍏ㄩ噺渚濊禆锛?|
| `cargo build --target x86_64-pc-windows-gnu` | 閫氳繃锛岀敓鎴愬彲鎵ц鏂囦欢骞跺畬鎴愰摼鎺?|
| GitHub Actions 路 windows-latest锛圡SVC锛?| 閫氳繃锛屼骇鍑?NSIS + MSI 瀹夎鍖?|
| GitHub Actions 路 macos-latest | 閫氳繃锛屼骇鍑?universal DMG |
| GitHub Actions 路 ubuntu-22.04 | 閫氳繃锛屼骇鍑?AppImage / DEB / RPM |
| 绀轰緥 `.lwd` 缁?TipTap schema 鏍￠獙 | 閫氳繃 |
| happy-dom 鎸傝浇鐢熶骇 bundle | 閫氳繃锛堢紪杈戝櫒/宸ュ叿鏍?24 涓寜閽甯告覆鏌擄級 |

鏈湴浜や粯鐜娌℃湁 MSVC/Windows SDK锛汳SVC 鏋勫缓鐢?GitHub Actions 鐨?`windows-latest` 瀹屾垚锛岃繍琛?`pnpm tauri build` 骞朵笂浼犲畨瑁呭寘銆俶acOS / Linux 鍚屾牱宸插湪 CI 涓畬鎴愭瀯寤猴紙瑙?[Actions](https://github.com/lq23256566678lj/qingwen-lwd/actions)锛夈€?
## 蹇嵎閿?
macOS 浣跨敤 鈱?/ 鈬?/ 鈱ワ紱Windows 涓?Linux 浣跨敤 Ctrl / Shift / Alt銆?
| 鎿嶄綔 | 蹇嵎閿?|
| --- | --- |
| 鏂板缓 / 鎵撳紑 / 淇濆瓨 / 鍙﹀瓨涓?| `Mod+N` / `Mod+O` / `Mod+S` / `Mod+Shift+S` |
| 鍏抽棴绐楀彛 / 閫€鍑?| `Mod+W` / `Mod+Q` |
| 鎾ら攢 / 閲嶅仛 | `Mod+Z` / `Mod+Shift+Z`锛圵indows 涔熸敮鎸?`Ctrl+Y`锛?|
| 鍔犵矖 / 鏂滀綋 / 涓嬪垝绾?/ 鍒犻櫎绾?| `Mod+B` / `Mod+I` / `Mod+U` / `Mod+Shift+X` |
| 楂樹寒 | `Mod+Shift+H` |
| 鏍囬 1鈥? / 姝ｆ枃 | `Mod+Alt+1..4` / `Mod+Alt+0` |
| 椤圭洰绗﹀彿 / 缂栧彿鍒楄〃 | `Mod+Shift+8` / `Mod+Shift+7` |
| 浠ｇ爜鍧?| `Mod+Alt+C` |
| 鏌ユ壘 / 鏇挎崲 | `Mod+F` / `Mod+H` |
| 鍏ㄩ€?| `Mod+A` |

鍘熺敓鑿滃崟涓殑鈥滄牸寮忊€濋」鍒绘剰涓嶇粦瀹氬揩鎹烽敭锛氱紪杈戝櫒鑷韩鐨?ProseMirror keymap 宸茬粡澶勭悊杩欎簺缁勫悎閿紝涓よ€呭悓鏃剁粦瀹氫細瀵艰嚧涓€娆℃寜閿墽琛屼袱娆★紙渚嬪鎾ら攢涓ゆ锛夈€傛枃浠剁被鍛戒护鍚屾椂娉ㄥ唽浜嗗師鐢熻彍鍗曞姞閫熼敭涓庡墠绔厹搴曠洃鍚紝骞剁敤 250 ms 鍘婚噸閬垮厤鍙岃Е鍙戙€?
## 鍏抽敭瀹炵幇璇存槑

### 鍥剧墖澶勭悊

- 鍥剧墖鍦ㄦ彃鍏ュ墠缁熶竴杞负 data URL锛氬伐鍏锋爮閫夊浘缁?Rust 璇诲彇骞跺仛鏂囦欢澶存牎楠岋紝绮樿创璧版祻瑙堝櫒 `ClipboardItem`锛屾嫋鍏ョ獥鍙ｈ蛋 Tauri `onDragDropEvent`銆?- 鏈€闀胯竟闄愬埗 1600 px锛岃秴杩囧垯鐢?canvas 閲嶉噰鏍凤紱杩囧ぇ鐨?JPEG/WebP 浼氶噸鏂扮紪鐮併€侴IF 淇濇寔鍘熸牱銆?- 鍐呭祵杩?`.lwd` 鐨勫ソ澶勬槸鍗曟枃浠惰嚜鍖呭惈銆佸鍑?HTML 鐩存帴鍙敤銆佹棤闇€ asset protocol 涓庝綔鐢ㄥ煙閰嶇疆锛涗唬浠锋槸鏂囦欢浣撶Н澧炲ぇ绾?1/3銆?- SVG 琚槑纭嫆缁濓紝閬垮厤鑴氭湰/澶栭儴寮曠敤锛涘浘鐗囩被鍨嬮€氳繃 magic bytes 鍒ゆ柇锛屾墿灞曞悕涓嶅彲淇°€?
### 鑷姩淇濆瓨绛栫暐

閲囩敤鈥滃弻閫氶亾 + 鍘熷瓙鍐欏叆鈥濓細

1. **鑽夌閫氶亾**锛堝缁堝紑鍚級锛氱紪杈戝仠姝?900 ms 鍚庡啓 `appDataDir/recovery/autosave.lwd`锛涘彟鏈?15 s 鐨勫厹搴曞畾鏃跺櫒锛岄伩鍏嶈繛缁緭鍏ユ椂 debounce 姘歌繙涓嶈Е鍙戙€傜敤浜庡穿婧?鏂數鎭㈠銆?2. **鏂囦欢閫氶亾**锛堟枃妗ｅ凡鏈夎矾寰勬椂锛夛細缂栬緫鍋滄 2.4 s 鍚庨潤榛樺啓鍥炲師 `.lwd`锛屽彟鏈?15 s 鍏滃簳銆?3. **鏄惧紡淇濆瓨**锛歚Ctrl/鈱?S` 绔嬪嵆鍐欏叆锛涢娆′繚瀛樻垨鈥滃彟瀛樹负鈥濆脊鍑虹郴缁熶繚瀛樺璇濇銆?4. 鎵€鏈夊啓鍏ュ厛鍐欏悓鐩綍涓存椂鏂囦欢銆乣sync_all`銆佸啀 `rename`锛涘悗绔繕浼氶噸鏂版牎楠屾枃妗ｇ粨鏋勪笌澶у皬銆?5. 淇濆瓨瀹屾垚鏃舵瘮杈?revision锛氬鏋滀繚瀛樻湡闂村張鏈夎緭鍏ワ紝涓嶆妸鐘舵€侀敊璇湴鏍囪涓衡€滃凡淇濆瓨鈥濄€?6. 鍏抽棴绐楀彛銆佹柊寤恒€佹墦寮€銆侀€€鍑哄墠閮戒細妫€鏌ユ湭淇濆瓨鐘舵€侊紝鎻愪緵鈥滀繚瀛樺苟缁х画 / 鏀惧純淇敼 / 鍙栨秷鈥濅笁閫変竴锛涘叧闂簨浠堕€氳繃 `onCloseRequested` 鎷︽埅銆?7. 鍚姩鏃惰鍙栬崏绋垮苟鏄剧ず鎭㈠鏉★紝涓嶈嚜鍔ㄨ鐩栫┖鐧芥枃妗ｃ€傛垚鍔熶繚瀛樸€佹斁寮冦€佹柊寤烘垨鎵撳紑鍙︿竴鏂囨。鏃舵竻闄よ崏绋裤€?
### 鏌ユ壘鏇挎崲

- 鐢?ProseMirror 鎻掍欢鐘舵€佷繚瀛樻煡璇笌鍛戒腑鑼冨洿锛岄€氳繃 `Decoration` 缁樺埗楂樹寒锛涙悳绱㈢姸鎬佷笉鍐欏叆鏂囨。锛屼笉浼氳鑷姩淇濆瓨銆佹挙閿€鏍堟垨 `.lwd` 搴忓垪鍖栨薄鏌撱€?- 鍚屼竴鏂囨湰鍧楀唴璺?mark 鍖归厤锛堜緥濡傗€滃姞绮楁枃瀛?+ 鏅€氭枃瀛椻€濈粍鎴愮殑璇嶇粍锛夊彲浠ユ壘鍒帮紱鍖归厤涓嶈法娈佃惤/鍗曞厓鏍笺€?- 鏇挎崲浣跨敤 `Transform.insertText` 鐨勫師鏂囨彃鍏ワ紝涓嶆妸鏇挎崲鍐呭褰撲綔 HTML 瑙ｆ瀽锛岄伩鍏?`<`銆乣&` 琚剰澶栬В閲娿€?- 涓枃杈撳叆娉曠粍鍚堟湡闂存殏鍋滄悳绱紝`compositionend` 鍚庡啀鎵ц銆?
### 涓枃杈撳叆娉?
- 缂栬緫鍣ㄥ唴瀹逛笉鍙?React 鎺у埗锛屼笉鍦ㄦ瘡娆¤緭鍏ユ椂 `setContent`锛涜嚜鍔ㄤ繚瀛樺彧鍋氶槻鎶栧簭鍒楀寲锛屼笉鎵撴柇 composition銆?- 鍏ㄥ眬 `keydown` 涓庢煡鎵鹃潰鏉块兘浼氭鏌?`isComposing` / `keyCode === 229`锛岀粍鍚堣緭鍏ユ湡闂翠笉鎶㈠揩鎹烽敭銆?- 宸ュ叿鏍忔寜閽?`mousedown` 闃绘榛樿琛屼负锛岄伩鍏嶇偣鍑绘寜閽椂閫夊尯涓庤緭鍏ユ硶鍊欓€夋琚牬鍧忋€?- 鏂囨。鍖哄煙璁剧疆 `lang="zh-CN"`銆佸叧闂嫾鍐欐鏌ワ紝鍑忓皯 WebView 鐨勮嚜鍔ㄦ洿姝ｅ共鎵般€?
## 宸茬煡闄愬埗

瀹屾暣鍒楄〃瑙?[`docs/limitations.md`](docs/limitations.md)锛屼富瑕侀」锛?
- 涓嶅吋瀹?`.docx`锛屼笉鎻愪緵瀵煎叆/瀵煎嚭 Word銆丳DF锛汬TML 瀵煎嚭鏄潤鎬侀〉闈紝涓嶅惈鍒嗛〉/椤电湁椤佃剼銆?- 绾枃鏈鍑轰細鎵佸钩鍖栬〃鏍间笌鍒楄〃锛堜繚鐣欐崲琛岋紝涓嶄繚鐣欏埗琛ㄧ/椤圭洰绗﹀彿锛夈€?- 鏌ユ壘鏇挎崲涓哄瓧闈㈤噺鍖归厤锛屼笉鏀寔姝ｅ垯銆佸叏璇嶅尮閰嶏紱鍖归厤涓嶈法鍧椼€?- 鍥剧墖鍏ㄩ儴鍐呭祵锛屾枃妗ｄ細闅忓浘鐗囧彉澶э紱涓嶆敮鎸?SVG銆佸浘娉ㄣ€佸浘鐗囨浛浠ｆ枃鏈紪杈?UI銆?- 琛ㄦ牸涓嶆敮鎸佸叕寮忋€佸崟鍏冩牸搴曡壊/杈规鑷畾涔夈€佽鍒楁嫋鎷芥帓搴忋€佸祵濂楄〃鏍笺€?- 鑷姩淇濆瓨鏄€滄渶鍚庡啓鍏ヨ€呰幏鑳溾€濓紝涓嶅鐞嗗閮ㄧ▼搴忓悓鏃朵慨鏀瑰悓涓€鏂囦欢锛涙病鏈夌増鏈巻鍙层€?- 鍗曠獥鍙ｃ€佸崟鏂囨。锛屾棤鏍囩椤碉紱鑽夌鍙繚鐣欐渶鍚庝竴浠姐€?- macOS / Linux 宸叉湁 CI 鏋勫缓浜х墿锛屼絾鏈湪鐪熸満涓婂畬鎴愯彍鍗曘€佽緭鍏ユ硶涓庡瓧浣撳洖褰掞紱Windows 瀹夎鍖呮湭绛惧悕锛屽彲鑳藉嚭鐜?SmartScreen 鎻愮ず銆?- 澶у瀷鏂囨。锛堟暟涓囨鎴栨暟鍗佸紶鍐呭祵鍥剧墖锛変笅锛屽伐鍏锋爮姣忎釜 transaction 閲嶆覆鏌撲笌鏁寸瘒 JSON 搴忓垪鍖栦細甯︽潵鍙劅鐭ュ欢杩熴€?
## 鏂囨。涓庣ず渚?
- [`.lwd` 鏍煎紡璇存槑](docs/lwd-format.md)
- [JSON Schema](docs/lwd-format.schema.json)
- [绀轰緥鏂囨。](examples/welcome.lwd)锛?7 涓《灞傝妭鐐癸紝鍚〃鏍笺€佸浘鐗囥€佷唬鐮佸潡銆侀摼鎺ワ級
- [宸茬煡闄愬埗](docs/limitations.md)

## License

MIT銆傝瑙?[LICENSE](LICENSE)銆?
