import {ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit} from '@angular/core';
import {
  getInternalGroupedDropdownOptions,
  InternalGroupedDropdownOption
} from '../../model/dropdown-option';
import {MysqlQueryService} from '../../services/mysql-query.service';
import {AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MysqlPersistService} from '../../services/mysql-persist.service';
import {ConfirmationService, MessageService} from 'primeng/api';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {v4 as uuidv4} from 'uuid';
import {Dropdown} from 'primeng/dropdown';

@Component({
  selector: 'app-edit-options-form',
  templateUrl: './options-edit-form.component.html',
  styleUrls: ['./options-edit-form.component.scss'],
  providers: [
    MessageService,
    ConfirmationService,
  ]
})
export class OptionsEditFormComponent implements OnInit, OnDestroy {
  @Input() optionType: 'activities' | 'districts';

  options: InternalGroupedDropdownOption[] = [];
  topOptions: InternalGroupedDropdownOption[] = [];

  optionsForm: FormGroup = new FormGroup({});

  addedIndex: number | undefined;

  blocked = false;
  loadingText = 'Schlagwörter werden abgerufen...';

  jsonCollapsed = true;

  sub: Subscription | undefined;

  sidebarExpanded = true;

  get optionsFormLength(): number {
    return (this.optionsForm?.controls?.options as FormArray)?.length || 0;
  }

  constructor(private mySqlQueryService: MysqlQueryService,
              private mySqlPersistService: MysqlPersistService,
              private messageService: MessageService,
              private confirmationService: ConfirmationService,
              private cdr: ChangeDetectorRef,
              private router: Router,
              private formBuilder: FormBuilder,
              private route: ActivatedRoute) {
  }

  @HostListener('window:beforeunload', ['$event']) unloadHandler(event: Event): void {
    event.returnValue = false;
  }

  async ngOnInit(): Promise<void> {
    this.sub = this.route.params.subscribe(async params => {
      if (params.optionType) {
        if (params.optionType !== this.optionType) {
          await this.reset(params.optionType);
        }
      }
    });

    if (this.optionType) {
      await this.reset(this.optionType);
    }
  }

  /**
   * queries options from database and reinits the form
   */
  async reinitForm(): Promise<void> {
    this.loadingText = 'Schlagwörter werden abgerufen...';
    this.blocked = true;
    this.addedIndex = undefined;

    if (this.optionType === 'activities') {
      this.options = getInternalGroupedDropdownOptions((await this.mySqlQueryService.getActivitiesOptions())?.data || []);
    } else if (this.optionType === 'districts') {
      this.options = getInternalGroupedDropdownOptions((await this.mySqlQueryService.getDistrictOptions())?.data || []);
    }

    this.optionsForm = new FormGroup({
      options: new FormArray([])
    });

    if (this.options?.length) {
      const optionControl = (this.optionsForm.controls.options as FormArray);

      this.options.forEach((option: InternalGroupedDropdownOption) => {
        optionControl.push(this.formBuilder.group({
          value: new FormControl(option.value, [Validators.required, Validators.min(0)]),
          category: new FormControl(option.category),
          categoryLabel: this.optionsForm.controls.options.value.find(o => o.value === option.category)?.label || null,
          label: new FormControl(option.label, Validators.required),
          isSubOption: new FormControl(!!option.category),
          showSubOptions: new FormControl(false)
        }));
      });
    }

    this.recalculateTopOptions();

    this.optionsForm.updateValueAndValidity();

    this.blocked = false;
  }

  /**
   * returns all form groups from a form array
   * @param control the form array control
   */
  getFormGroupsFromFormArray(control: AbstractControl): FormGroup[] | undefined {
    try {
      const fa: FormArray = control as FormArray;

      if (fa) {
        return fa.controls.map((c: AbstractControl) => c as FormGroup);
      }
    } catch {
    }
    return undefined;
  }

  /**
   * get a specific form group from a form array
   * @param array the form array
   * @param index the index of the form group to return
   */
  getFormArrayFormGroup(array: string, index: number): FormGroup | undefined {
    try {
      return ((this.optionsForm.controls[array] as FormArray).at(index) as FormGroup);
    } catch {
      return undefined;
    }
  }

  /**
   * remove a element form a form array by its index
   * @param formArray the form array
   * @param i index
   */
  remove(formArray: AbstractControl, i: number): void {
    this.confirmationService.confirm({
      header: 'Löschen?',
      message: `Möchten Sie diese Option wirklich löschen?<br><br>Wenn Sie Schlagwörter-Kategorien verändern oder `
        + `löschen,<br>kann dies zu fehlerhaften Zuordnungen von Vereinen zu <br>`
        + `${this.optionType === 'activities' ? 'Tätigkeitsfeldern' : (this.optionType === 'districts' ? 'Aktivitätsgebieten' : 'Schlagwörtern')}`
        + ` führen!`,
      acceptLabel: 'OK',
      rejectLabel: 'Abbrechen',
      closeOnEscape: true,
      accept: async () => {
        this.addedIndex = undefined;
        if (formArray as FormArray) {
          (formArray as FormArray).removeAt(i);
        }
      }
    });
  }

  /**
   * adds a sub-option to the form array
   * @param index position to insert
   * @param category top category to add the option to
   */
  addOption(index: number, category: string): void {
    this.addedIndex = undefined;

    const value = uuidv4();

    const formArray: FormArray = this.optionsForm.controls.options as FormArray;

    if (formArray) {
      const formGroup: FormGroup = this.formBuilder.group({
        value: new FormControl(value, [Validators.required, Validators.min(0)]),
        category: new FormControl(category === '' ? null : category),
        label: new FormControl('', Validators.required),
        categoryLabel: this.topOptions.find(o => o.value === category)?.label || null,
        isSubOption: !!category,
        showSubOptions: new FormControl(false)
      });

      formArray.insert(index, formGroup);

      const added = formArray.controls.find((fc: AbstractControl) => fc === formGroup) as FormGroup;
      if (added) {
        this.addedIndex = formArray.controls.indexOf(added);

        this.optionsForm.updateValueAndValidity();

        setTimeout(() => {
          const elem = document.getElementsByClassName('added')?.item(0) as Element;
          if (elem) {
            const labelInput = elem.querySelector('.label-input');
            if (labelInput) {
              (labelInput as HTMLInputElement)?.focus();
            }
          }
        });
      }
    }
  }

  /**
   * checks if a specific form control in a specific form array has a specific error
   * @param array the form array to check
   * @param index the index of the form group to check
   * @param control the control's name to check
   * @param error the error to check for
   */
  public errorHandlingForFormArray(array: string, index: number, control: string, error: string): boolean {
    try {
      return ((this.optionsForm.controls[array] as FormArray).at(index) as FormGroup).controls[control].hasError(error);
    } catch {
      return false;
    }
  }

  /**
   * resets the form
   * @param optionType optional option type to change the currently edited options type
   */
  async reset(optionType?: 'activities' | 'districts'): Promise<void> {
    if (this.hasFormValueChanged()) {
      this.confirmationService.confirm({
        header: 'Änderungen zurücksetzen?',
        message: 'Möchten Sie Ihre Änderungen wirklich zurücksetzen?',
        acceptLabel: 'OK',
        rejectLabel: 'Abbrechen',
        closeOnEscape: true,
        accept: async () => {
          if (optionType && optionType !== this.optionType) {
            this.optionType = optionType;
          }
          await this.reinitForm();
          window.history.replaceState({}, '', `${environment.rootPath}/options-form/${this.optionType}`);
        }
      });
    } else {
      if (optionType && optionType !== this.optionType) {
        this.optionType = optionType;
      }
      await this.reinitForm();
      window.history.replaceState({}, '', `${environment.rootPath}/options-form/${this.optionType}`);
    }
  }

  /**
   * submits the form data, and creates or updates the edited options
   */
  async submit(): Promise<void> {
    this.blocked = true;
    this.loadingText = 'Schlagwörter werden gespeichert...';
    const options = this.optionsForm.value.options.map((o: any) => {
      return {
        label: o.label,
        value: o.value,
        category: o.category === '' ? null : o.category
      };
    }).sort((a: any, b: any) =>
      !a.category && !!b.category ? -1 : !!a.category && !b.category ? 1 : 0
    );
    if (this.optionType === 'activities') {
      await this.mySqlPersistService.createActivityOptions(options).toPromise()
        .then(async () => {
          this.blocked = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Schlagwörter wurden gespeichert.',
            key: 'editFormToast'
          });
          await this.reinitForm();
        })
        .catch((reason) => {
          this.blocked = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Schlagwörter konnte nicht gespeichert werden.',
            detail: JSON.stringify(reason),
            key: 'editFormToast'
          });
        });
    } else if (this.optionType === 'districts') {
      await this.mySqlPersistService.createDistrictOptions(options).toPromise()
        .then(async () => {
          this.blocked = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Schlagwörter wurden gespeichert.',
            key: 'editFormToast'
          });
          await this.reinitForm();
        })
        .catch((reason) => {
          this.blocked = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Schlagwörter konnten nicht gespeichert werden.',
            detail: JSON.stringify(reason),
            key: 'editFormToast'
          });
        });
    }
  }

  /**
   * checks if any changes were made in the form
   */
  private hasFormValueChanged(): boolean {
    if (!(this.optionsForm?.controls?.options as FormArray)?.controls?.length) {
      return false;
    }
    const oldOptions = this.options.map((o: InternalGroupedDropdownOption) => {
      return {
        label: o.label,
        value: o.value,
        category: o.category === '' ? null : o.category
      };
    }).sort((option1: any, option2: any) =>
      option1.value < option2.value ? -1 : (option1.value > option2.value ? 1 : (option1.label < option2.value ? -1 : 1))
    );
    const newOptions = this.optionsForm.value.options.map((o: any) => {
      return {
        label: o.label,
        value: o.value,
        category: o.category === '' ? null : o.category
      };
    }).sort((option1: any, option2: any) =>
      option1.value < option2.value ? -1 : (option1.value > option2.value ? 1 : (option1.label < option2.value ? -1 : 1))
    );

    console.log(JSON.stringify(oldOptions) !== JSON.stringify(newOptions));

    return JSON.stringify(oldOptions) !== JSON.stringify(newOptions);
  }

  /**
   * sorts the form array by option categories and values
   * @param options all form array options
   */
  private sortFormArray(options: FormArray): AbstractControl[] {
    this.blocked = true;
    this.loadingText = 'Schlagwörter sortieren...';
    if (!options?.length) {
      return [];
    }

    const sortedOptions = options.controls.sort((ac1: AbstractControl, ac2: AbstractControl) => {
      const a: InternalGroupedDropdownOption = {
        value: ac1.value.value,
        label: ac1.value.label,
        category: ac1.value.category,
        categoryLabel: ac1.value.category != null
          ? this.options.find((o: InternalGroupedDropdownOption) => o.category === ac1.value.category)?.categoryLabel || ac1.value.label
          : ac1.value.label,
        isSubOption: ac1.value.category != null
      };

      const b: InternalGroupedDropdownOption = {
        value: ac2.value.value,
        label: ac2.value.label,
        category: ac2.value.category,
        categoryLabel: ac2.value.category != null
          ? this.options.find((o: InternalGroupedDropdownOption) => o.category === ac2.value.category)?.categoryLabel || ac2.value.label
          : ac2.value.label,
        isSubOption: ac2.value.category != null
      };

      return a.categoryLabel < b.categoryLabel ? -1 :
        (a.categoryLabel > b.categoryLabel ? 1 :
            (!!a.isSubOption && !b.isSubOption ? 1 :
                (!a.isSubOption && !!b.isSubOption ? -1 :
                    (a.label < b.label ? -1 :
                        (a.label > b.label ? 1 : 0)
                    )
                )
            )
        );
    });
    this.blocked = false;
    return sortedOptions;
  }

  /**
   * reorders all options when a category dropdown value is changed
   * @param newCategory new category value
   * @param options form array control
   * @param optionForm option form group
   * @param dropdown the dropdown input element
   */
  changeCategoryDropdown(newCategory: any, options: AbstractControl, optionForm: FormGroup, dropdown: Dropdown): void {
    const value = optionForm.value.value;
    const oldCategory = optionForm.value.category;

    if (newCategory !== oldCategory) {
      if (value === newCategory) {
        this.confirmationService.confirm({
          header: 'Kategorie-Auswahl ungültig',
          message: `Als übergeordnete Kategorie kann nicht die Option selbst gewählt werden.`,
          acceptLabel: 'OK',
          rejectVisible: false,
          closeOnEscape: true,
          accept: () => {
            optionForm.controls.category.setValue(oldCategory);
            dropdown.writeValue(oldCategory);
            optionForm.updateValueAndValidity();
          }
        });
        return;
      } else if (!newCategory || !oldCategory) {
        this.confirmationService.confirm({
          header: 'Achtung!',
          message: `Wenn Sie eine Unterkategorie in eine übergeordnete Kategorie abändern oder<br>`
            + `eine übergeordnete Kategorie in eine Unterkategorie verwandeln, kann dies zu<br>`
            + `fehlerhaften Zuordnungen von `
            + `${this.optionType === 'activities' ? 'Tätigkeitsfeldern' : (this.optionType === 'districts' ? 'Aktivitätsgebieten' : 'Schlagwörtern')} führen!`,
          acceptLabel: 'OK',
          rejectLabel: 'Abbrechen',
          closeOnEscape: true,
          accept: () => {
            // set new category value
            optionForm.controls.category.setValue(newCategory);
            dropdown.writeValue(newCategory);

            if (!!newCategory) {
              optionForm.controls.showSubOptions.setValue(true);
            }

            // set isSubOption control
            const isSubOption = !!newCategory;
            optionForm.controls.isSubOption.setValue(isSubOption);

            this.optionsForm.updateValueAndValidity();

            // recalculate all top options, delete invalid top options from form and recalculate top options again
            this.recalculateTopOptions();
            this.deleteInvalidTopOptions();
            this.recalculateTopOptions();

            // sort options by category label and label
            if (options instanceof FormArray) {
              this.sortFormArray(options);
            }

            // scroll to shifted form input
            this.scrollToShiftedElementWithValue(value);
          },
          reject: () => {
            optionForm.controls.category.setValue(oldCategory);
            dropdown.writeValue(oldCategory);
          }
        });
      } else {
        // set new category value
        optionForm.controls.category.setValue(newCategory);
        dropdown.writeValue(newCategory);

        // sort options by category label and label
        if (options instanceof FormArray) {
          this.sortFormArray(options);
        }

        // scroll to shifted form input
        this.scrollToShiftedElementWithValue(value);
      }
    }
  }

  /**
   * recalculates the top options when a label of a top category is changed
   * @param label changed top category label
   * @param isSubOption is sub option
   */
  changeCategoryLabel(label: string, isSubOption: boolean): void {
    if (!isSubOption) {
      this.recalculateTopOptions();
    }
  }

  /**
   * recalculates a list of all available top options
   */
  recalculateTopOptions(): void {
    const selfTopOption = [{value: null, label: '(Übergeordnete Kategorie)', categoryLabel: null, isSubOption: false}];
    const newTopOptions: InternalGroupedDropdownOption[] = (this.optionsForm.controls.options as FormArray).controls
      .filter((formGroup: FormGroup) => {
        return !formGroup.value.category;
      }).map((formGroup: FormGroup) => {
        return {
          value: formGroup.value.value,
          label: formGroup.value.label,
          category: null,
          categoryLabel: null,
          isSubOption: false
        };
      });
    this.topOptions = selfTopOption.concat(newTopOptions);
  }

  /**
   * deletes invalid top options that are not existing anymore from form fields
   */
  deleteInvalidTopOptions(): void {
    const options: FormArray = this.optionsForm.controls.options as FormArray;
    options.controls.forEach((fg: FormGroup) => {
      const categoryControl = fg.controls.category;
      const categoryValue = categoryControl.value;
      const topOptionValues = this.topOptions.map(to => to.value);
      if (!topOptionValues.includes(categoryValue)) {
        categoryControl.setValue(null);
      }
    });
  }

  /**
   * sorts the form array, looks for the changed element by its value and scrolls to the element after sorting
   * @param value the value to search for
   */
  scrollToShiftedElementWithValue(value: string): void {
    this.optionsForm.updateValueAndValidity();
    this.cdr.detectChanges();

    const elements: HTMLInputElement[] = Array.from(document.querySelectorAll('.hidden-input input'));
    const element: HTMLInputElement | undefined = elements.find((i: HTMLInputElement) => i.value === value);

    if (element) {
      element.scrollIntoView();
      const windowPositionY = window.scrollY;
      window.scrollTo({top: (windowPositionY - 80)});
    }
  }

  /**
   * toggles visibility of the sidebar
   */
  toggleSidebar(): void {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  /**
   * shows or hides sub options
   */
  async toggleShowSubOptions(optionForm: FormGroup): Promise<void> {
    this.blocked = true;
    this.loadingText = 'Unterkategorien ' + (optionForm.value.showSubOptions ? 'verstecken...' : 'anzeigen...');
    const previousShowSubOptions = optionForm.value.showSubOptions;
    optionForm.controls.showSubOptions.setValue(!previousShowSubOptions);
    if (!previousShowSubOptions) {
      this.scrollToShiftedElementWithValue(optionForm.value.value);
    }
    this.blocked = false;
  }

  /**
   * returns if the sub options for a specific top category should be displayed or hidden
   * @param value value of the top category
   */
  showSubOptions(value: string): boolean {
    const formArray = (this.optionsForm?.controls?.options as FormArray)?.controls;
    if (formArray) {
      const topCategory = formArray.find((a: FormGroup) =>
        a.value.value === value
      );
      if (topCategory) {
        return topCategory.value.showSubOptions;
      }
    }
    return false;
  }

  /**
   * navigate to the association form
   */
  async editAssociations(): Promise<void> {
    await this.router.navigate(['/']);
  }

  /**
   * deactivate guard
   */
  async canDeactivate(): Promise<boolean> {
    return await this.leavePage();
  }

  /**
   * show dialog on page-leave if something changed in the form
   */
  async leavePage(): Promise<boolean> {
    if (!!this.optionType && this.hasFormValueChanged()) {
      return new Promise((resolve) => {
        this.confirmationService.confirm({
          header: 'Änderungen verwerfen?',
          message: `Wenn Sie die Seite verlassen, gehen nicht gespeicherte Änderungen verloren.`,
          acceptLabel: 'OK',
          rejectLabel: 'Abbrechen',
          closeOnEscape: true,
          accept: () => {
            resolve(true);
          },
          reject: () => {
            resolve(false);
          }
        });
      });
    } else {
      return true;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}