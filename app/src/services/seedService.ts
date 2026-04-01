import { batchSave } from './supabaseService';
import { getInitialData } from '../utils/initialData';

export const seedFirestore = async () => {
    const { disciplines, classes, cohorts } = getInitialData();

    try {
        console.log('Iniciando o envio de dados padrão para o Firestore...');

        await batchSave('disciplines', disciplines);
        await batchSave('classes', classes);
        await batchSave('cohorts', cohorts);

        console.log('Envio de dados padrão concluído com sucesso.');
        return true;
    } catch (error) {
        console.error('Erro ao enviar dados padrão:', error);
        throw error;
    }
};
