import ModuleComponent from './module-enhanced.vue';

export default {
	id: 'import-excel',
	name: 'Import Excel',
	icon: 'upload_file',
	routes: [
		{
			path: '',
			component: ModuleComponent,
		},
	],
};
