import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const modelDir = path.join(projectRoot, 'public', 'assets', 'huohuo')
const modelPath = path.join(modelDir, 'huohuo.model3.json')

const requiredMotionGroups = ['Scene1', 'haoqi', 'keshui', 'linghun', 'qizi', 'yaotou', 'zhentou']
const errors = []

function relative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, '/')
}

function log(message) {
  console.log(`[Live2D Check] ${message}`)
}

function addError(message) {
  errors.push(message)
  console.error(`[Live2D Check] ERROR: ${message}`)
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

function checkReferencedFile(label, reference) {
  if (!reference || typeof reference !== 'string') {
    addError(`${label} reference is missing or invalid`)
    return
  }

  const filePath = path.join(modelDir, reference)
  if (!fileExists(filePath)) {
    addError(`${label} not found: ${relative(filePath)}`)
  }
}

let model

if (!fileExists(modelPath)) {
  addError(`huohuo.model3.json not found: ${relative(modelPath)}`)
} else {
  log('huohuo.model3.json found')

  try {
    model = JSON.parse(fs.readFileSync(modelPath, 'utf8'))
  } catch (error) {
    addError(`huohuo.model3.json is not valid JSON: ${error.message}`)
  }
}

if (model) {
  const fileReferences = model.FileReferences
  if (!fileReferences || typeof fileReferences !== 'object') {
    addError('FileReferences is missing')
  } else {
    checkReferencedFile('Moc', fileReferences.Moc)
    if (fileReferences.Moc) log('Moc found')

    if (!Array.isArray(fileReferences.Textures) || fileReferences.Textures.length === 0) {
      addError('Textures is missing or empty')
    } else {
      for (const texture of fileReferences.Textures) {
        checkReferencedFile('Texture', texture)
      }
      log(`Textures found: ${fileReferences.Textures.length}`)
    }

    for (const optionalKey of ['Physics', 'Pose', 'DisplayInfo', 'UserData']) {
      if (fileReferences[optionalKey]) {
        checkReferencedFile(optionalKey, fileReferences[optionalKey])
      }
    }

    const motions = fileReferences.Motions
    if (!motions || typeof motions !== 'object' || Array.isArray(motions)) {
      addError('FileReferences.Motions is missing or invalid')
    } else {
      const motionGroups = Object.keys(motions)
      log(`Motion groups found: ${motionGroups.join(', ')}`)

      for (const group of requiredMotionGroups) {
        if (!Array.isArray(motions[group]) || motions[group].length === 0) {
          addError(`Required motion group is missing or empty: ${group}`)
        }
      }

      for (const [group, entries] of Object.entries(motions)) {
        if (!Array.isArray(entries)) {
          addError(`Motion group is not an array: ${group}`)
          continue
        }

        entries.forEach((entry, index) => {
          if (!entry || typeof entry !== 'object') {
            addError(`Motion entry is invalid: ${group}[${index}]`)
            return
          }

          checkReferencedFile(`Motion ${group}[${index}]`, entry.File)
        })
      }
    }
  }
}

if (errors.length > 0) {
  process.exitCode = 1
} else {
  log('All referenced files exist')
  log('OK')
}
