import { useEffect, useState } from 'react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

import { IS_TAURI } from '../lib/platform'
import type { SyncSettings } from '../lib/types'
import { Modal } from './Modal'

export interface SyncSettingsDraft {
  url: string
  username: string
  password: string
  localAutosaveSeconds: number
  cloudUploadSeconds: number
  defaultSaveDir: string
  clearCredentials: boolean
}

interface SyncSettingsDialogProps {
  open: boolean
  settings: SyncSettings
  saving: boolean
  onSave: (draft: SyncSettingsDraft) => void
  onClose: () => void
}

export function SyncSettingsDialog({
  open,
  settings,
  saving,
  onSave,
  onClose,
}: SyncSettingsDialogProps) {
  const [url, setUrl] = useState(settings.url)
  const [username, setUsername] = useState(settings.username)
  const [password, setPassword] = useState('')
  const [localInterval, setLocalInterval] = useState(
    String(settings.localAutosaveSeconds),
  )
  const [cloudInterval, setCloudInterval] = useState(
    String(settings.cloudUploadSeconds),
  )
  const [defaultSaveDir, setDefaultSaveDir] = useState(settings.defaultSaveDir)
  const [clearCredentials, setClearCredentials] = useState(false)

  useEffect(() => {
    if (!open) return
    setUrl(settings.url)
    setUsername(settings.username)
    setPassword('')
    setLocalInterval(String(settings.localAutosaveSeconds))
    setCloudInterval(String(settings.cloudUploadSeconds))
    setDefaultSaveDir(settings.defaultSaveDir)
    setClearCredentials(false)
  }, [open, settings])

  const localSeconds = Number.parseInt(localInterval, 10)
  const cloudSeconds = Number.parseInt(cloudInterval, 10)
  const intervalError =
    localInterval.trim() === '' ||
    Number.isNaN(localSeconds) ||
    localSeconds < 0 ||
    (localSeconds > 0 && localSeconds < 5) ||
    cloudInterval.trim() === '' ||
    Number.isNaN(cloudSeconds) ||
    cloudSeconds < 0 ||
    (cloudSeconds > 0 && cloudSeconds < 30)

  const submit = () => {
    if (intervalError || saving) return
    onSave({
      url: url.trim(),
      username,
      password: clearCredentials ? '' : password,
      localAutosaveSeconds: localSeconds,
      cloudUploadSeconds: cloudSeconds,
      defaultSaveDir,
      clearCredentials,
    })
  }

  const chooseFolder = async () => {
    if (!IS_TAURI) return
    const chosen = await openDialog({
      title: '选择默认保存文件夹',
      directory: true,
      multiple: false,
    })
    if (typeof chosen === 'string' && chosen) setDefaultSaveDir(chosen)
  }

  return (
    <Modal
      open={open}
      title="云盘同步设置"
      subtitle="通过 WebDAV 把文档备份到自己的云盘；上传为覆盖式，下载会覆盖当前文档。"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={intervalError || saving}
            data-autofocus
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </>
      }
    >
      <div className="sync-settings">
        <div className="sync-field">
          <span className="setup-label">默认保存文件夹（不使用 WebDAV 时）</span>
          <div className="sync-folder-row">
            <input
              type="text"
              className="sync-input"
              value={defaultSaveDir}
              placeholder="尚未选择文件夹"
              readOnly
              title={defaultSaveDir}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void chooseFolder()}
              disabled={!IS_TAURI}
            >
              选择…
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDefaultSaveDir('')}
              disabled={!defaultSaveDir}
            >
              清除
            </button>
          </div>
          <span className="setup-hint">
            当 WebDAV URL 为空时，新建文档会静默写入此文件夹，文件名使用文档标题
            （如 <code>未命名文档.lwd</code>）；自动保存也写回这里。可以直接选择
            OneDrive / 坚果云 / 百度网盘的本地同步文件夹，应用本身不访问网络。
          </span>
        </div>

        <label className="sync-field">
          <span className="setup-label">WebDAV 服务器目录 URL</span>
          <input
            type="url"
            className="sync-input"
            value={url}
            placeholder="https://dav.example.com/remote.php/dav/files/me/Qingwen/"
            onChange={(event) => setUrl(event.target.value)}
            spellCheck={false}
          />
          <span className="setup-hint">
            请填写一个目录 URL；每个文档按本地文件名上传到该目录下，末尾斜杠会自动补全。
            服务器上需要先创建这个目录。
          </span>
        </label>

        <div className="sync-row">
          <label className="sync-field">
            <span className="setup-label">用户名</span>
            <input
              type="text"
              className="sync-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </label>
          <label className="sync-field">
            <span className="setup-label">密码</span>
            <input
              type="password"
              className="sync-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                settings.hasPassword ? '已保存，留空保持不变' : 'WebDAV 密码'
              }
              autoComplete="new-password"
              disabled={clearCredentials}
            />
          </label>
        </div>

        <label className="sync-check">
          <input
            type="checkbox"
            checked={clearCredentials}
            onChange={(event) => setClearCredentials(event.target.checked)}
          />
          <span>清除系统钥匙串中已保存的用户名和密码</span>
        </label>

        <div className="sync-security">
          用户名和密码会保存到系统钥匙串（Windows Credential Manager /
          macOS Keychain / Linux Secret Service），不会写入配置文件或日志。
        </div>

        <div className="sync-row">
          <label className="sync-field">
            <span className="setup-label">本地自动保存间隔（秒）</span>
            <input
              type="number"
              className="sync-input"
              min={0}
              max={86400}
              step={1}
              value={localInterval}
              onChange={(event) => setLocalInterval(event.target.value)}
            />
            <span className="setup-hint">
              默认 60 秒；填 0 关闭本地文件自动保存。会话崩溃恢复仍会工作。
            </span>
          </label>
          <label className="sync-field">
            <span className="setup-label">云盘自动上传间隔（秒）</span>
            <input
              type="number"
              className="sync-input"
              min={0}
              max={86400}
              step={1}
              value={cloudInterval}
              onChange={(event) => setCloudInterval(event.target.value)}
            />
            <span className="setup-hint">
              默认 300 秒；填 0 关闭自动上传。只有当前标签页有本地变更时才上传，
              失败会显示在状态栏，并在下个间隔重试。
            </span>
          </label>
        </div>
        {intervalError ? (
          <p className="sync-error">
            间隔需为 0（关闭）或至少 5 秒（本地）/ 30 秒（云盘）。
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
