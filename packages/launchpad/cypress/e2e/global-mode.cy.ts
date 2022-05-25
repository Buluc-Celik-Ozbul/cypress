import defaultMessages from '@packages/frontend-shared/src/locales/en-US.json'
import path from 'path'
import type { SinonSpy } from 'sinon'

const sep = Cypress.platform === 'win32' ? '\\' : '/'

describe('Launchpad: Global Mode', () => {
  describe('when no projects have been added', () => {
    it('shows "Add Project" view', () => {
      cy.openGlobalMode()
      cy.visitLaunchpad()
      cy.get('h1').should('contain', defaultMessages.globalPage.empty.title)
      cy.get('[data-cy="dropzone"]')
      .should('contain', defaultMessages.globalPage.empty.dropText.split('{0}')[0])
      .find('button')
      .should('contain', 'browse manually')
    })

    it('can add a project by dragging folder into project dropzone', () => {
      cy.openGlobalMode()
      cy.visitLaunchpad()
      cy.get('h1').should('contain', defaultMessages.globalPage.empty.title)
      cy.get('[data-cy="dropzone"]')
      .should('contain', defaultMessages.globalPage.empty.dropText.split('{0}')[0])

      cy.scaffoldProject('todos')
      .then((projectPath) => {
        cy.get('[data-cy="dropzone"]')
        .dropFileWithPath(projectPath)
      })

      cy.contains('Welcome to Cypress!')
      cy.get('a').contains('Projects').click()
      cy.get('[data-cy="project-card"]')
      .should('have.length', 1)
      .should('contain', 'todos')
    })

    it('adds a project using electron native folder select', () => {
      cy.openGlobalMode()
      cy.visitLaunchpad()

      cy.scaffoldProject('todos')
      .then((projectPath) => {
        cy.withCtx(async (ctx, o) => {
          o.sinon.stub(ctx.actions.electron, 'showOpenDialog').resolves(o.projectPath)
        }, { projectPath })
      })

      cy.get('h1').should('contain', defaultMessages.globalPage.empty.title)
      cy.get('[data-cy="dropzone"]')
      .should('contain', defaultMessages.globalPage.empty.dropText.split('{0}')[0])
      .find('button')
      .should('contain', 'browse manually')
      .click()

      cy.get('[data-cy="project-card"]')
      .should('have.length', 1)

      cy.contains('[data-cy="project-card"]', 'todos').should('be.visible')
      cy.containsPath('[data-cy="project-card"]', path.join('cy-projects', 'todos')).should('be.visible')
    })
  })

  describe('when projects have been added', () => {
    const setupAndValidateProjectsList = (projectList, globalModeOptions?: string[] | undefined) => {
      cy.openGlobalMode(globalModeOptions)
      projectList.forEach((projectName) => {
        cy.addProject(projectName)
      })

      cy.visitLaunchpad()

      cy.log('The recents list shows all projects that have been added')
      cy.contains(defaultMessages.globalPage.recentProjectsHeader)
      .should('be.visible')

      cy.get('[data-cy="project-card"]')
      .should('have.length', projectList.length)
      .each((card, index) => {
        expect(card).to.contain(projectList[index])
        expect(card).to.contain(`cy-projects${sep}${projectList[index]}`)
      })
    }

    it('shows the recent projects list sorted by most-recently opened', () => {
      const projectList = ['todos', 'ids', 'cookies', 'plugin-empty']

      setupAndValidateProjectsList(projectList)
    })

    it('takes user to the next step when clicking on a project card', () => {
      const projectList = ['todos']

      setupAndValidateProjectsList(projectList)
      cy.get('[data-cy="project-card"]').click()
      cy.get('[data-cy="project-card"]').should('not.exist')
    })

    it('takes the user to the next step when clicking on a project card when passing testing type on the command line', () => {
      const projectList = ['todos']

      setupAndValidateProjectsList(projectList, ['--e2e'])
      cy.get('[data-cy="project-card"]').click()
      cy.get('[data-cy="project-card"]').should('not.exist')
    })

    it('updates most-recently opened project list when returning from next step', () => {
      const projectList = ['todos', 'ids', 'cookies', 'plugin-empty']

      setupAndValidateProjectsList(projectList)

      cy.get('[data-cy="project-card"]').contains('cookies').click()

      cy.contains('Welcome to Cypress!')
      cy.get('a').contains('Projects').click()

      cy.get('[data-cy="project-card"]')
      .should('have.length', projectList.length)
      // TODO: fix most recently updated list ()
      // https://cypress-io.atlassian.net/browse/UNIFY-646
      // .then((list) => {
      // expect(list.get(0)).to.contain(projectList[2])
      // expect(list.get(0)).to.contain(path.join('cy-projects', path.sep, projectList[2]))
      // })
    })

    it('can open and close the add project dropzone', () => {
      setupAndValidateProjectsList(['todos'])
      cy.log('Clicking the "Add Project" button shows the Project Dropzone')
      cy.get('[data-cy="addProjectButton"').click()
      cy.get('[data-cy="dropzone"]').should('exist')

      cy.log('Clicking the x to close the project add area closes the Project Dropzone')
      cy.get('[data-cy="dropzone"]')
      .find('button[aria-label="Close"]')
      .click()

      cy.get('[data-cy="dropzone"]').should('not.exist')

      cy.get('[data-cy="addProjectButton"').click()
      cy.get('[data-cy="dropzone"]').should('exist')

      cy.get('[data-cy="addProjectButton"').click()
      cy.get('[data-cy="dropzone"]').should('not.exist')
    })

    it('updates breadcrumb when selecting a project and navigating back', () => {
      const getBreadcrumbLink = (name: string, options: { disabled: boolean } = { disabled: false }) => {
        return cy.findByRole('link', { name }).should('have.attr', 'aria-disabled', options.disabled ? 'true' : 'false')
      }

      const resetSpies = () => {
        return cy.withCtx((ctx) => {
          (ctx.actions.project.clearCurrentProject as SinonSpy).resetHistory();
          (ctx.actions.wizard.resetWizard as SinonSpy).resetHistory();
          (ctx.lifecycleManager.setAndLoadCurrentTestingType as SinonSpy).resetHistory()
        })
      }

      const projectList = ['todos']

      setupAndValidateProjectsList(projectList)

      cy.withCtx((ctx, { sinon }) => {
        sinon.spy(ctx.actions.project, 'clearCurrentProject')
        sinon.spy(ctx.actions.wizard, 'resetWizard')
        sinon.spy(ctx.lifecycleManager, 'setAndLoadCurrentTestingType')
      })

      // Component testing breadcrumbs
      cy.get('[data-cy="project-card"]').contains('todos').click()
      cy.get('[data-cy-testingtype="component"]').click()
      cy.contains('li', 'component testing', { matchCase: false }).should('not.have.attr', 'href')
      resetSpies()
      getBreadcrumbLink('todos').click()
      getBreadcrumbLink('todos', { disabled: true })
      cy.withCtx((ctx) => {
        expect(ctx.lifecycleManager.setAndLoadCurrentTestingType).to.have.been.calledWith(null)
      })

      cy.get('[data-cy-testingtype="component"]').click()
      cy.contains('li', 'component testing', { matchCase: false }).should('not.have.attr', 'href')
      resetSpies()
      getBreadcrumbLink('Projects').click()
      getBreadcrumbLink('Projects', { disabled: true })
      cy.withCtx((ctx) => {
        expect(ctx.actions.project.clearCurrentProject).to.have.been.called
        expect(ctx.actions.wizard.resetWizard).to.have.been.called
      })

      // E2E testing breadcrumbs
      cy.get('[data-cy="project-card"]').contains('todos').click()
      cy.get('[data-cy-testingtype="e2e"]').click()
      cy.contains('li', 'e2e testing', { matchCase: false }).should('not.have.attr', 'href')
      resetSpies()
      getBreadcrumbLink('todos').click()
      getBreadcrumbLink('todos', { disabled: true })
      cy.withCtx((ctx) => {
        expect(ctx.lifecycleManager.setAndLoadCurrentTestingType).to.have.been.calledWith(null)
      })

      cy.get('[data-cy-testingtype="e2e"]').click()
      cy.contains('li', 'e2e testing', { matchCase: false }).should('not.have.attr', 'href')
      resetSpies()
      getBreadcrumbLink('Projects').click()
      getBreadcrumbLink('Projects', { disabled: true })
      cy.withCtx((ctx) => {
        expect(ctx.actions.project.clearCurrentProject).to.have.been.called
        expect(ctx.actions.wizard.resetWizard).to.have.been.called
      })
    })

    describe('Project card menu', () => {
      it('can be opened', () => {
        setupAndValidateProjectsList(['todos'])
        cy.log('Project cards have a menu can be opened')
        cy.get('[aria-label="Project Actions"]').click()
        cy.get('[data-cy="Remove Project"]').contains(defaultMessages.globalPage.removeProject)
        cy.get('[data-cy="Open In IDE"]').contains(defaultMessages.globalPage.openInIDE)
        cy.get('[data-cy="Open In Finder"]').contains(defaultMessages.globalPage.openInFinder)
      })

      it('removes project from list when clicking "Remove Project" menu item', () => {
        const projectList = ['todos', 'cookies']

        setupAndValidateProjectsList(projectList)
        cy.get('[aria-label="Project Actions"]').then((menu) => {
          menu.get(0).click()
        })

        cy.get('[data-cy="Remove Project"]').click()

        cy.get('[data-cy="project-card"]')
        .should('have.length', 1)
        .should('contain', projectList[1])
      })

      it('opens "Open in IDE" modal when clicking "Open in IDE" menu item and IDE had not been configured', () => {
        const projectList = ['todos']

        setupAndValidateProjectsList(projectList)
        cy.get('[aria-label="Project Actions"]').click()

        cy.get('[data-cy="Open In IDE"]').click()
        cy.contains('External Editor Preferences')
      })

      it('shows file drop zone when no more projects are in list when clicking "Remove Project" menu item', () => {
        setupAndValidateProjectsList(['todos'])
        cy.get('[aria-label="Project Actions"]').click()
        cy.get('[data-cy="Remove Project"]').click()

        cy.get('[data-cy="project-card"]').should('not.exist')
        cy.get('[data-cy="dropzone"]')
        .should('contain', defaultMessages.globalPage.empty.dropText.split('{0}')[0])
      })
    })

    describe('Searching the project list', () => {
      const projectList = ['todos', 'ids', 'cookies', 'plugin-empty']

      it('filters project results when searching by project name', () => {
        setupAndValidateProjectsList(projectList)
        cy.log('Searching for a project by the project name will filter the project results to only show that project')
        cy.get('#project-search').type('tod')
        cy.get('[data-cy="project-card"]')
        .should('have.length', 1)
        .contains('todos')
        .containsPath('cy-projects/todos')

        cy.log('Deleting the search pattern restores the project list')
        cy.get('#project-search').type('{backspace}{backspace}{backspace}')
        cy.get('[data-cy="project-card"]')
        .should('have.length', projectList.length)
      })

      // FIXME: fix Search by project path logic - https://cypress-io.atlassian.net/browse/UNIFY-646
      it.skip('filters project results when searching by project path', () => {
        setupAndValidateProjectsList(projectList)
        cy.get('#project-search').type('packages')
        cy.get('[data-cy="project-card"')
        .should('have.length', projectList.length)

        cy.get('#project-search').type(`${path.sep}todos`)
        cy.contains(defaultMessages.globalPage.noResultsMessage)
      })

      it('shows "empty results" pages when searching for a non-existent name', () => {
        setupAndValidateProjectsList(projectList)
        cy.get('#project-search').type('hi')
        cy.get('[data-cy="project-card"]')
        .should('have.length', 0)

        cy.contains(defaultMessages.globalPage.noResultsMessage)

        cy.log('Clicking "clear search" in the empty search results will clear the searchbar and restore the project list')
        cy.get('[data-cy="no-results-clear"]').click()
        cy.get('[data-cy="project-card"]')
        .should('have.length', projectList.length)
      })

      // FIXME: fix Search by project path logic - https://cypress-io.atlassian.net/browse/UNIFY-646
      it.skip('shows "empty results" pages when searching for a non-existent path', () => {
        setupAndValidateProjectsList(projectList)
        cy.get('#project-search').type('packages')
        cy.get('[data-cy="project-card"')
        .should('have.length', projectList.length)

        cy.get('#project-search').type(`${path.sep}random`)
        cy.contains(defaultMessages.globalPage.noResultsMessage)
      })
    })
  })
})
